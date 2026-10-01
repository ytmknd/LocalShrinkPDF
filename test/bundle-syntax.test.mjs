import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('配布用HTML内のスクリプトが構文解析できる', async () => {
  const html = await readFile('index.html', 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .filter((match) => !match[0].includes('type="text/plain"'));
  if (scripts.length !== 2) throw new Error(`Expected 2 executable scripts, got ${scripts.length}`);
  assert.match(scripts[0][1], /locateFile: \(name\) => name/);
  assert.match(scripts[0][1], /signal\.addEventListener\("abort", abort/);
  for (const [index, script] of scripts.entries()) {
    try {
      new vm.Script(script[1], { filename: `index.html script ${index + 1}` });
    } catch (error) {
      const lines = error.stack.split('\n');
      const lineNumber = Number(lines[0].match(/:(\d+)$/)?.[1]);
      const column = lines[2]?.indexOf('^') ?? -1;
      const sourceLines = script[1].split('\n');
      const sourceLine = sourceLines[lineNumber - 1] || '';
      throw new Error(`Script ${index + 1} failed at ${lineNumber}:${column}, nearby:\n${sourceLines.slice(lineNumber - 7, lineNumber + 3).join('\n')}; ${error.message}`);
    }
  }
});
