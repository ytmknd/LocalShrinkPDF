import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const worker = await build({
  entryPoints: ['node_modules/pdfjs-dist/build/pdf.worker.mjs'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  write: false,
  minify: true,
});

const qpdfBrowserOriginal = await readFile('node_modules/@wasm-zoo/qpdf/browser-qpdf.js', 'utf8');
const locateFileExpression = 'locateFile: (name) => new URL(name, coreJsUrl).href';
if (!qpdfBrowserOriginal.includes(locateFileExpression)) {
  throw new Error('QPDF browser wrapper changed: review the blob URL fix before building.');
}
// The runtime is already given the WASM bytes. A blob: URL cannot be a base URL.
let qpdfBrowser = qpdfBrowserOriginal.replace(locateFileExpression, 'locateFile: (name) => name');
function patchQpdfBrowser(before, after) {
  if (!qpdfBrowser.includes(before)) throw new Error('QPDF browser wrapper changed: review the cancellation patch before building.');
  qpdfBrowser = qpdfBrowser.replace(before, after);
}
patchQpdfBrowser(
  'const worker = createOuterWorker(); let settled = false; const timeoutMs = Number(options.timeoutMs || 0); let timer = null;',
  'const worker = createOuterWorker(); let settled = false; const timeoutMs = Number(options.timeoutMs || 0); let timer = null; const signal = options.signal; let abort = null;'
);
patchQpdfBrowser(
  'const finish = () => { if (timer) clearTimeout(timer); worker.terminate(); };',
  'const finish = () => { if (timer) clearTimeout(timer); if (signal && abort) signal.removeEventListener("abort", abort); worker.terminate(); };'
);
patchQpdfBrowser(
  'if (Number.isFinite(timeoutMs) && timeoutMs > 0) timer = setTimeout',
  'if (signal) { abort = () => { const error = new Error("PDF compression cancelled."); error.name = "AbortError"; rejectOnce(error); }; if (signal.aborted) { abort(); return; } signal.addEventListener("abort", abort, { once: true }); }\n        if (Number.isFinite(timeoutMs) && timeoutMs > 0) timer = setTimeout'
);
const qpdfRuntime = await readFile('node_modules/@wasm-zoo/qpdf/qpdf-core.js', 'utf8');
const qpdfWasm = await readFile('node_modules/@wasm-zoo/qpdf/qpdf-core.wasm');

const app = await build({
  entryPoints: ['src/app.js'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  write: false,
  minify: true,
  define: {
    __PDF_WORKER_SOURCE__: JSON.stringify(worker.outputFiles[0].text),
    __QPDF_RUNTIME_SOURCE__: JSON.stringify(qpdfRuntime),
    __QPDF_WASM_BASE64__: JSON.stringify(qpdfWasm.toString('base64')),
  },
});
new vm.Script(app.outputFiles[0].text, { filename: 'app bundle' });
const escapedApp = app.outputFiles[0].text.replaceAll('</script', '<\\/script');
new vm.Script(escapedApp, { filename: 'escaped app bundle' });

const template = await readFile('src/index.html', 'utf8');
const projectLicense = await readFile('LICENSE', 'utf8');
const licenses = await Promise.all([
  readFile('node_modules/pdfjs-dist/LICENSE', 'utf8'),
  readFile('node_modules/pdf-lib/LICENSE.md', 'utf8'),
  readFile('node_modules/@wasm-zoo/qpdf/LICENSE.wasm-zoo.txt', 'utf8'),
  readFile('node_modules/@wasm-zoo/qpdf/LICENSES/QPDF-NOTICE.md', 'utf8'),
  readFile('node_modules/@wasm-zoo/qpdf/LICENSES/QPDF-LICENSE.txt', 'utf8'),
  readFile('node_modules/@wasm-zoo/qpdf/LICENSES/zlib-LICENSE.txt', 'utf8'),
  readFile('node_modules/@wasm-zoo/qpdf/LICENSES/libjpeg-README.txt', 'utf8'),
]);
const licenseTags = licenses.map((license, index) =>
  `<script type="text/plain" id="third-party-license-${index + 1}">${license.replaceAll('</script', '<\\/script')}</script>`).join('\n');
const html = template.replace('<!-- APP_SCRIPT -->', () =>
  `<script>${qpdfBrowser.replaceAll('</script', '<\\/script')}</script>\n<script>${escapedApp}</script>\n<script type="text/plain" id="project-license">${projectLicense}</script>\n${licenseTags}`);
const executableScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .filter((match) => !match[0].includes('type="text/plain"'));
if (executableScripts[1]?.[1] !== escapedApp) {
  const actual = executableScripts[1]?.[1] || '';
  let position = 0;
  while (position < Math.min(actual.length, escapedApp.length) && actual[position] === escapedApp[position]) position++;
  throw new Error(`HTML script differs from bundle at ${position}: ${JSON.stringify(actual.slice(position, position + 80))} vs ${JSON.stringify(escapedApp.slice(position, position + 80))}`);
}
await writeFile('index.html', html);
console.log(`Built index.html (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB)`);
