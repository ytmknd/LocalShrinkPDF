import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { PDFDocument, PDFName, PDFString, StandardFonts } from 'pdf-lib';

if (!Uint8Array.prototype.toHex) {
  Uint8Array.prototype.toHex = function () { return Buffer.from(this).toString('hex'); };
}

const require = createRequire(import.meta.url);

function makePng(width, height) {
  function crc32(bytes) {
    let value = 0xffffffff;
    for (const byte of bytes) {
      value ^= byte;
      for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    }
    return (value ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const name = Buffer.from(type);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
    return Buffer.concat([length, name, data, checksum]);
  }
  const pixels = Buffer.alloc((width * 3 + 1) * height);
  let seed = 12345;
  for (let row = 0; row < height; row++) {
    const start = row * (width * 3 + 1);
    for (let col = 0; col < width; col++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const gray = seed >>> 24;
      const offset = start + 1 + col * 3;
      pixels.fill(gray, offset, offset + 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function qpdfContext() {
  const runtime = await readFile('node_modules/@wasm-zoo/qpdf/qpdf-core.js', 'utf8');
  const wasm = await readFile('node_modules/@wasm-zoo/qpdf/qpdf-core.wasm');
  const context = vm.createContext({
    process, require, __dirname: resolve('node_modules/@wasm-zoo/qpdf'), module: { exports: {} },
    Buffer, URL, TextDecoder, TextEncoder, WebAssembly, setTimeout, clearTimeout, setInterval, clearInterval, console,
  });
  vm.runInContext(runtime, context, { filename: 'qpdf.js' });
  return await context.createQpdfCore({ wasmBinary: new Uint8Array(wasm), noInitialRun: true, print: console.log, printErr: console.error });
}

test('構造を保った圧縮で文字とリンクが残る', async () => {
  const source = await PDFDocument.create();
  const font = await source.embedFont(StandardFonts.Helvetica);
  const page = source.addPage([500, 500]);
  page.drawText('Searchable text', { x: 50, y: 430, font, size: 18 });
  const image = await source.embedPng(makePng(600, 600));
  page.drawImage(image, { x: 50, y: 50, width: 400, height: 350 });
  const field = source.getForm().createTextField('reply');
  field.setText('Editable');
  field.addToPage(page, { x: 260, y: 420, width: 180, height: 28 });
  const link = source.context.obj({
    Type: PDFName.of('Annot'), Subtype: PDFName.of('Link'),
    Rect: [50, 420, 230, 450], Border: [0, 0, 0],
    A: { S: PDFName.of('URI'), URI: PDFString.of('https://example.com/') },
  });
  page.node.addAnnot(source.context.register(link));
  const input = await source.save({ useObjectStreams: false });
  const qpdf = await qpdfContext();
  qpdf.FS.writeFile('/input.pdf', input);
  const result = qpdf.callMain([
    '--progress', '--object-streams=generate', '--compress-streams=y', '--decode-level=generalized',
    '--recompress-flate', '--compression-level=9', '--optimize-images', '--jpeg-quality=75',
    '--', '/input.pdf', '/output.pdf',
  ]);
  assert.equal(result, 0);
  const output = Buffer.from(qpdf.FS.readFile('/output.pdf'));
  assert.ok(output.length > 0);
  assert.ok(output.length < input.length, `Expected compression: ${input.length} -> ${output.length}`);
  const preservedForm = await PDFDocument.load(output);
  assert.equal(preservedForm.getForm().getTextField('reply').getText(), 'Editable');

  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(output), useSystemFonts: true });
  const pdf = await task.promise;
  const outPage = await pdf.getPage(1);
  const text = await outPage.getTextContent();
  const annotations = await outPage.getAnnotations();
  assert.match(text.items.map((item) => item.str).join(' '), /Searchable text/);
  assert.ok(annotations.some((annotation) => annotation.url === 'https://example.com/'));
  await task.destroy();
});
