import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

test('file:// で開き、通信なしでPDFを圧縮できる', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    const page = await browser.newPage({ acceptDownloads: true });
    const requests = [];
    page.on('request', (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(pathToFileURL(resolve('index.html')).href);
    const pngData = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1400;
      const ctx = canvas.getContext('2d');
      const data = ctx.createImageData(canvas.width, canvas.height);
      let seed = 12345;
      for (let i = 0; i < data.data.length; i += 4) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const shade = (seed >>> 24) & 255;
        data.data[i] = shade;
        data.data[i + 1] = shade;
        data.data[i + 2] = shade;
        data.data[i + 3] = 255;
      }
      return canvas.toDataURL('image/png').split(',')[1];
    });
    const inputDoc = await PDFDocument.create();
    const image = await inputDoc.embedPng(Buffer.from(pngData, 'base64'));
    for (let i = 0; i < 2; i++) {
      const pdfPage = inputDoc.addPage([500, 700]);
      pdfPage.drawImage(image, { x: 0, y: 0, width: 500, height: 700 });
    }
    const input = await inputDoc.save();
    await page.locator('#fileInput').setInputFiles({ name: 'sample.pdf', mimeType: 'application/pdf', buffer: Buffer.from(input) });
    await page.locator('#compress').click();
    await page.locator('#result.visible').waitFor({ timeout: 60000 });
    const message = await page.locator('#resultMessage').textContent();
    assert.match(message, /小さくなりました/);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download').click();
    const download = await downloadPromise;
    const output = await readFile(await download.path());
    assert.ok(output.length < input.length);
    const outputDoc = await PDFDocument.load(output);
    assert.equal(outputDoc.getPageCount(), 2);
    assert.deepEqual(requests, []);
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
  }
});
