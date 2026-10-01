import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('大きなPDFの処理を中止するとワーカーを停止する', async () => {
  const html = await readFile('index.html', 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
  assert.ok(script);
  class FakeWorker {
    constructor() { FakeWorker.last = this; this.terminated = false; }
    postMessage() {}
    terminate() { this.terminated = true; }
  }
  class TestURL extends URL {
    static createObjectURL() { return 'blob:http://localhost/worker'; }
    static revokeObjectURL() {}
  }
  const window = {};
  vm.runInNewContext(script, {
    window, document: { baseURI: 'http://localhost/' },
    Worker: FakeWorker, WebAssembly, URL: TestURL, Blob,
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
    setTimeout, clearTimeout, Uint8Array, ArrayBuffer, TypeError, Error,
  });
  const runner = window.WasmZooQpdf.loadHosted({
    baseUrl: 'http://localhost/', coreJsUrl: 'blob:http://localhost/core', wasmUrl: 'blob:http://localhost/wasm',
  });
  const controller = new AbortController();
  const operation = runner.exec(['/input.pdf', '/output.pdf'], {
    files: [{ name: '/input.pdf', data: new Uint8Array([1]) }],
    outputs: ['/output.pdf'], signal: controller.signal,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.abort();
  await assert.rejects(operation, /cancelled/);
  assert.equal(FakeWorker.last.terminated, true);
});
