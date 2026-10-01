import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/build/pdf.mjs';
import { PDFDocument } from 'pdf-lib';
import { selectLanguage, translate } from './i18n.js';

const $ = (id) => document.getElementById(id);
const language = selectLanguage(navigator.language);
const t = (key, params) => translate(language, key, params);
document.documentElement.lang = language;
document.title = t('title');
for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
for (const element of document.querySelectorAll('[data-i18n-aria-label]')) element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
for (const element of document.querySelectorAll('[data-i18n-title]')) element.title = t(element.dataset.i18nTitle);
const state = { file: null, running: false, cancelled: false, downloadUrl: null, renderTask: null, workerUrl: null, worker: null, qpdfRunner: null, qpdfUrls: [], qpdfAbort: null };

function formatSize(bytes) {
  return bytes >= 1000000 ? `${(bytes / 1000000).toFixed(2)} MB` : `${(bytes / 1000).toFixed(0)} KB`;
}

function reveal(id) {
  $(id).scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
}

function setProgress(value, label, detail = '') {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  $('progressWrap').classList.add('visible');
  $('progressTrack').classList.remove('indeterminate');
  $('progressLabel').textContent = label;
  $('progressPercent').textContent = `${percent}%`;
  $('progressBar').style.width = `${percent}%`;
  $('progressTrack').setAttribute('aria-valuenow', String(percent));
  $('status').textContent = detail;
  $('status').classList.remove('error');
}

function setIndeterminate(label, detail = '') {
  $('progressWrap').classList.add('visible');
  $('progressTrack').classList.add('indeterminate');
  $('progressTrack').removeAttribute('aria-valuenow');
  $('progressLabel').textContent = label;
  $('progressPercent').textContent = t('processing');
  $('status').textContent = detail;
  $('status').classList.remove('error');
}

function showError(message) {
  $('progressWrap').classList.add('visible');
  $('progressTrack').classList.remove('indeterminate');
  $('progressLabel').textContent = t('failed');
  $('progressPercent').textContent = '';
  $('status').textContent = message;
  $('status').classList.add('error');
  reveal('progressWrap');
}

function clearResult() {
  $('result').classList.remove('visible');
  if ($('previewDialog').open) $('previewDialog').close();
  $('previewFrame').removeAttribute('src');
  if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl);
  state.downloadUrl = null;
}

function chooseFile(file) {
  if (state.running || !file) return;
  clearResult();
  $('progressWrap').classList.remove('visible');
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    state.file = null;
    $('fileInfo').classList.remove('visible');
    $('compress').disabled = true;
    showError(t('choosePdf'));
    return;
  }
  state.file = file;
  $('fileName').textContent = file.name;
  $('fileSize').textContent = formatSize(file.size);
  $('fileInfo').classList.add('visible');
  $('compress').disabled = false;
}

function targetBytes() {
  const selection = $('target').value;
  const mb = selection === 'custom' ? Number($('customTarget').value) : Number(selection);
  if (!Number.isFinite(mb) || mb < 1 || mb > 500) throw new Error(t('targetRange'));
  return mb * 1000 * 1000;
}

function compressionProfiles() {
  const preset = $('quality').value;
  if (preset === 'quality') return [{ dpi: 150, quality: .84 }, { dpi: 120, quality: .75 }, { dpi: 96, quality: .66 }];
  if (preset === 'size') return [{ dpi: 96, quality: .66 }, { dpi: 78, quality: .55 }, { dpi: 62, quality: .46 }];
  return [{ dpi: 120, quality: .75 }, { dpi: 96, quality: .66 }, { dpi: 78, quality: .55 }];
}

function qpdfQualities() {
  const preset = $('quality').value;
  return preset === 'quality' ? [85, 75, 65] : preset === 'size' ? [60, 50, 40] : [75, 65, 55];
}

function qpdfArgs(quality) {
  const args = ['--progress', '--object-streams=generate', '--compress-streams=y', '--decode-level=generalized', '--recompress-flate', '--compression-level=9'];
  args.push('--optimize-images', `--jpeg-quality=${quality}`);
  return [...args, '--', '/input.pdf', '/output.pdf'];
}

async function ensureQpdfRunner() {
  if (state.qpdfRunner) return state.qpdfRunner;
  const qpdfJsUrl = URL.createObjectURL(new Blob([__QPDF_RUNTIME_SOURCE__], { type: 'text/javascript' }));
  const binary = Uint8Array.from(atob(__QPDF_WASM_BASE64__), (character) => character.charCodeAt(0));
  const wasmUrl = URL.createObjectURL(new Blob([binary], { type: 'application/wasm' }));
  state.qpdfUrls.push(qpdfJsUrl, wasmUrl);
  state.qpdfRunner = window.WasmZooQpdf.loadHosted({ baseUrl: location.href, coreJsUrl: qpdfJsUrl, wasmUrl });
  try {
    await state.qpdfRunner.load();
  } catch (error) {
    state.qpdfRunner.dispose();
    state.qpdfRunner = null;
    throw error;
  }
  return state.qpdfRunner;
}

async function compressPreserving(file, goal) {
  setIndeterminate(t('engine'));
  state.qpdfAbort = new AbortController();
  const runner = await ensureQpdfRunner();
  if (state.cancelled) throw new Error('cancelled');
  const input = new Uint8Array(await file.arrayBuffer());
  if (input.length < 5 || String.fromCharCode(...input.slice(0, 5)) !== '%PDF-') throw new Error(t('invalidPdf'));
  let best = null;
  const allQualities = qpdfQualities();
  const largeFile = file.size >= 100000000;
  const qualities = largeFile ? [allQualities[file.size / goal >= 3 ? 2 : 0]] : allQualities;
  for (let index = 0; index < qualities.length; index++) {
    if (state.cancelled) throw new Error('cancelled');
    const started = Date.now();
    const label = largeFile ? t('largePdf') : t('preserving', { pass: index + 1, count: qualities.length });
    const detail = () => t('elapsed', { minutes: Math.floor((Date.now() - started) / 60000), seconds: String(Math.floor((Date.now() - started) / 1000) % 60).padStart(2, '0') });
    setIndeterminate(label, detail());
    const timer = setInterval(() => { if (!state.cancelled) $('status').textContent = detail(); }, 1000);
    const onLog = ({ message }) => {
      const percent = Number(String(message).match(/(?:^|\s)(\d{1,3})\s*%/)?.[1]);
      if (Number.isFinite(percent) && percent >= 0 && percent <= 100) {
        setProgress(((index + percent / 100) / qualities.length) * 100, label, detail());
      }
    };
    const args = qpdfArgs(qualities[index]);
    let bytes;
    try {
      const result = await runner.exec(args, { files: [{ name: '/input.pdf', data: input.slice() }], outputs: ['/output.pdf'], timeoutMs: 900000, onLog, signal: state.qpdfAbort.signal });
      bytes = result.files.find((item) => item.name === '/output.pdf')?.data;
    } catch (error) {
      if (state.cancelled) throw new Error('cancelled');
      if (best) break;
      throw error;
    } finally {
      clearInterval(timer);
    }
    if (!bytes) throw new Error(t('outputFailed'));
    if (!best || bytes.length < best.length) best = bytes;
    if (bytes.length <= goal && bytes.length < file.size) break;
  }
  if (state.cancelled) throw new Error('cancelled');
  if (!best || best.length < 5 || String.fromCharCode(...best.slice(0, 5)) !== '%PDF-') throw new Error(t('outputFailed'));
  return best;
}

function ensureWorker() {
  if (state.worker) return;
  state.workerUrl = URL.createObjectURL(new Blob([__PDF_WORKER_SOURCE__], { type: 'text/javascript' }));
  state.worker = new Worker(state.workerUrl, { type: 'module' });
  GlobalWorkerOptions.workerPort = state.worker;
}

async function renderJpeg(page, profile) {
  const baseViewport = page.getViewport({ scale: 1 });
  const pixelsAtDpi = baseViewport.width * baseViewport.height * (profile.dpi / 72) ** 2;
  const scale = (profile.dpi / 72) * Math.min(1, Math.sqrt(12000000 / pixelsAtDpi));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error(t('canvasFailed'));
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  try {
    state.renderTask = page.render({ canvasContext: context, viewport, background: 'white' });
    await state.renderTask.promise;
    if (state.cancelled) throw new Error('cancelled');
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error(t('imageFailed'))), 'image/jpeg', profile.quality));
    if (state.cancelled) throw new Error('cancelled');
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width: baseViewport.width, height: baseViewport.height };
  } finally {
    state.renderTask = null;
    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();
  }
}

async function compressPass(pdf, profile, passIndex, passCount) {
  const output = await PDFDocument.create();
  for (let index = 1; index <= pdf.numPages; index++) {
    if (state.cancelled) throw new Error('cancelled');
    setProgress(((passIndex + (index - 1) / pdf.numPages) / passCount) * 100,
      t('page', { page: index, count: pdf.numPages }), t('adjustment', { pass: passIndex + 1, count: passCount }));
    const page = await pdf.getPage(index);
    const image = await renderJpeg(page, profile);
    const embedded = await output.embedJpg(image.bytes);
    const newPage = output.addPage([image.width, image.height]);
    newPage.drawImage(embedded, { x: 0, y: 0, width: image.width, height: image.height });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return await output.save({ useObjectStreams: true });
}

function resultName(name) {
  return `${name.replace(/\.pdf$/i, '')}-compressed.pdf`;
}

function showResult(bytes, goal, file) {
  $('beforeSize').textContent = formatSize(file.size);
  $('afterSize').textContent = formatSize(bytes.length);
  $('result').classList.add('visible');
  const smaller = bytes.length < file.size;
  const reached = bytes.length <= goal;
  const saved = Math.round((1 - bytes.length / file.size) * 100);
  $('resultMessage').textContent = smaller
    ? t('smaller', { percent: saved, target: t(reached ? 'reached' : 'missed') })
    : t('noSavings');
  $('download').style.display = smaller ? 'inline-block' : 'none';
  $('previewButton').style.display = smaller ? 'inline-block' : 'none';
  if (smaller) {
    state.downloadUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    $('download').href = state.downloadUrl;
    $('download').download = resultName(file.name);
  }
  reveal('result');
}

async function compress() {
  if (state.running || !state.file) return;
  let goal;
  try { goal = targetBytes(); } catch (error) { showError(error.message); return; }
  const file = state.file;
  state.running = true;
  state.cancelled = false;
  $('compress').disabled = true;
  $('fileInput').disabled = true;
  $('cancel').style.display = 'inline-block';
  $('cancel').disabled = false;
  clearResult();
  setProgress(0, t('reading'));
  reveal('progressWrap');
  let loadingTask;
  let pdf;
  try {
    if ($('mode').value === 'preserve') {
      const bytes = await compressPreserving(file, goal);
      setProgress(100, t('complete'));
      showResult(bytes, goal, file);
      return;
    }
    ensureWorker();
    const input = new Uint8Array(await file.arrayBuffer());
    if (input.length < 5 || String.fromCharCode(...input.slice(0, 5)) !== '%PDF-') throw new Error(t('invalidPdf'));
    loadingTask = getDocument({ data: input, useSystemFonts: true, disableFontFace: false });
    pdf = await loadingTask.promise;
    if (state.cancelled) throw new Error('cancelled');
    const profiles = compressionProfiles();
    let best = null;
    for (let i = 0; i < profiles.length; i++) {
      const bytes = await compressPass(pdf, profiles[i], i, profiles.length);
      if (!best || bytes.length < best.length) best = bytes;
      if ((bytes.length <= goal && bytes.length < file.size) || state.cancelled) break;
    }
    if (state.cancelled) throw new Error('cancelled');
    setProgress(100, t('complete'));
    showResult(best, goal, file);
  } catch (error) {
    if (state.cancelled || error?.message === 'cancelled' || error?.name === 'RenderingCancelledException') {
      setProgress(0, t('cancelled'));
    } else if (error?.name === 'PasswordException') {
      showError(t('password'));
    } else {
      console.error(error);
      showError(/timed out/i.test(error?.message) ? t('timeout') : /memory|allocation|out of bounds/i.test(error?.message) ? t('memory') : Object.values({ invalidPdf: t('invalidPdf'), outputFailed: t('outputFailed'), canvasFailed: t('canvasFailed'), imageFailed: t('imageFailed') }).includes(error?.message) ? error.message : t('genericError'));
    }
  } finally {
    if (loadingTask) await loadingTask.destroy();
    state.qpdfAbort = null;
    state.running = false;
    $('compress').disabled = !state.file;
    $('fileInput').disabled = false;
    $('cancel').style.display = 'none';
  }
}

$('fileInput').addEventListener('change', (event) => { chooseFile(event.target.files[0]); event.target.value = ''; });
for (const eventName of ['dragenter', 'dragover']) $('dropZone').addEventListener(eventName, (event) => { event.preventDefault(); $('dropZone').classList.add('dragging'); });
for (const eventName of ['dragleave', 'drop']) $('dropZone').addEventListener(eventName, (event) => { event.preventDefault(); $('dropZone').classList.remove('dragging'); });
$('dropZone').addEventListener('drop', (event) => chooseFile(event.dataTransfer.files[0]));
$('dropZone').addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); $('fileInput').click(); } });
$('target').addEventListener('change', () => $('targetRow').classList.toggle('custom', $('target').value === 'custom'));
$('mode').addEventListener('change', () => {
  $('modeNote').textContent = $('mode').value === 'preserve'
    ? t('preserveNote')
    : t('rasterNote');
});
$('compress').addEventListener('click', compress);
$('previewButton').addEventListener('click', () => {
  if (!state.downloadUrl) return;
  $('previewFrame').src = state.downloadUrl;
  $('previewDialog').showModal();
});
$('previewClose').addEventListener('click', () => $('previewDialog').close());
$('previewDialog').addEventListener('close', () => $('previewFrame').removeAttribute('src'));
$('cancel').addEventListener('click', () => { state.cancelled = true; state.renderTask?.cancel(); state.qpdfAbort?.abort(); $('cancel').disabled = true; $('status').textContent = t('cancelling'); });
window.addEventListener('beforeunload', () => { if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl); if (state.workerUrl) URL.revokeObjectURL(state.workerUrl); state.qpdfRunner?.dispose(); for (const url of state.qpdfUrls) URL.revokeObjectURL(url); });
