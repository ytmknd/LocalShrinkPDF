import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { messages, selectLanguage, translate } from '../src/i18n.js';

test('Japanese browser language selects Japanese; all other languages select English', () => {
  assert.equal(selectLanguage('ja-JP'), 'ja');
  assert.equal(selectLanguage('ja'), 'ja');
  assert.equal(selectLanguage('en-US'), 'en');
  assert.equal(selectLanguage('fr-FR'), 'en');
  assert.equal(translate('en-US', 'failed'), 'Could not process the PDF');
  assert.equal(translate('ja-JP', 'failed'), '処理できませんでした');
  assert.equal(translate('en-US', 'pointOffline'), 'Your PDF is never sent to a server');
  assert.equal(translate('ja-JP', 'pointOffline'), 'PDFはサーバーへ送信されません');
  assert.equal(translate('en-US', 'preserving', { pass: 1, count: 3 }), 'Compressing while preserving PDF structure · 1 / 3');
});

test('both languages cover every static message in the HTML', async () => {
  const html = await readFile('src/index.html', 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-aria-label|-title)?="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(Object.keys(messages.ja).sort(), Object.keys(messages.en).sort());
  for (const key of keys) {
    assert.ok(messages.en[key], `English: ${key}`);
    assert.ok(messages.ja[key], `Japanese: ${key}`);
  }
  assert.match(html, /<option value="5" data-i18n="recommended">5 MB \(recommended\)<\/option>/);
  assert.match(html, /id="previewFrame"[^>]+data-i18n-title="previewTitle"/);
});
