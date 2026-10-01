export function selectLanguage(language = '') {
  return /^ja(?:-|$)/i.test(language) ? 'ja' : 'en';
}

export const messages = {
  en: {
    title: 'Shrink PDF | Local PDF Compressor', brand: 'Shrink PDF', private: 'Processed on your device', eyebrow: 'NO INSTALLATION · LOCAL PROCESSING',
    heading: 'Make large PDFs small enough to email.', intro: 'Select a file to compress it entirely in your browser. Your PDF is never uploaded. No installation or account is required.',
    pointOffline: 'Your PDF is never sent to a server', pointPreserve: 'Option to preserve searchable text and links', pointSave: 'Check the size before saving',
    panel: 'PDF compression', drop: 'Choose a PDF or drop it here', oneFile: 'One file at a time', mode: 'Compression method',
    preserve: 'Preserve text and links (recommended)', raster: 'Convert pages to images for stronger compression',
    preserveNote: 'Preserves text search and copying, links, forms, and more. The amount saved depends on the PDF.',
    rasterNote: 'Converts each page to an image. This can greatly reduce size, but text search and copying, links, and forms will be lost.',
    target: 'Target size', recommended: '5 MB (recommended)', custom: 'Custom', targetAria: 'Target size in MB',
    targetNote: 'Set this a little below your recipient’s attachment limit.', quality: 'Image quality priority', balanced: 'Balanced (recommended)', qualityHigh: 'Clear text and photos', qualitySmall: 'Smaller file',
    compress: 'Compress PDF', preparing: 'Preparing…', cancel: 'Cancel', result: 'Compression result', originalSize: 'Original size', compressedSize: 'Compressed size', download: 'Save compressed PDF', previewShow: 'Preview compressed PDF', previewHide: 'Close preview', previewTitle: 'Compressed PDF preview',
    footnote: '“Preserve text and links” recompresses PDF contents and interactive elements, but rewriting invalidates digital signatures. “Convert pages to images” removes selectable and searchable text, links, forms, and bookmarks. The original PDF is not changed. Password-protected PDFs are unsupported. Very large PDFs may exceed the memory available on your device.',
    processing: 'Processing', failed: 'Could not process the PDF', choosePdf: 'Please select a PDF file.', targetRange: 'Set a target between 1 and 500 MB.',
    engine: 'Preparing the PDF compression engine…', invalidPdf: 'This file could not be read as a PDF.', largePdf: 'Compressing a large PDF', preserving: 'Compressing while preserving PDF structure · {pass} / {count}', elapsed: 'Text and links are preserved. Elapsed: {minutes}m {seconds}s',
    outputFailed: 'Could not create the compressed PDF.', canvasFailed: 'The browser could not create an image.', imageFailed: 'Could not create an image.',
    page: 'Compressing · page {page} / {count}', adjustment: 'Quality pass {pass} / {count}', smaller: '{percent}% smaller. {target}', reached: 'Within the target size.', missed: 'The target size was not reached.', noSavings: 'This PDF could not be made smaller with this method.',
    reading: 'Reading the PDF…', complete: 'Complete', cancelled: 'Cancelled', password: 'Password-protected PDFs are unsupported.', cancelling: 'Cancelling…', genericError: 'The PDF could not be processed. Please try another file or compression method.', timeout: 'Compression took too long. Try a smaller PDF or the image conversion method.', memory: 'There is not enough memory to process this PDF on this device.'
  },
  ja: {
    title: 'PDFを軽くする | ローカルPDF圧縮', brand: 'PDFを軽くする', private: '端末内だけで処理', eyebrow: 'インストール不要 · 端末内で処理',
    heading: '大きなPDFを、メールで送れるサイズへ。', intro: 'ファイルを選んで、ブラウザ内で圧縮します。PDFは外部へ送信されません。インストールもアカウント登録も不要です。',
    pointOffline: 'PDFはサーバーへ送信されません', pointPreserve: '文字やリンクを保つ圧縮方式を選択可能', pointSave: '処理後のサイズを確認して保存',
    panel: 'PDF圧縮', drop: 'PDFを選択、またはここにドロップ', oneFile: '1ファイルずつ処理します', mode: '圧縮方式',
    preserve: '文字・リンクを維持（おすすめ）', raster: '画像化して強く圧縮',
    preserveNote: '文字検索・コピー、リンク、フォームなどを維持します。圧縮率はPDFによって異なります。',
    rasterNote: '各ページを画像に変換します。大幅に縮められますが、文字検索・コピーやリンクなどは失われます。',
    target: '目標サイズ', recommended: '5 MB（おすすめ）', custom: '指定する', targetAria: '目標サイズ（MB）',
    targetNote: '送信先の添付上限より少し低めに設定してください。', quality: '画質の優先度', balanced: '標準（おすすめ）', qualityHigh: '文字や写真をきれいに', qualitySmall: 'サイズを小さく',
    compress: 'PDFを圧縮する', preparing: '準備中…', cancel: '中止する', result: '圧縮結果', originalSize: '元のサイズ', compressedSize: '圧縮後', download: '圧縮したPDFを保存', previewShow: '圧縮後のPDFをプレビュー', previewHide: 'プレビューを閉じる', previewTitle: '圧縮後のPDFのプレビュー',
    footnote: '「文字・リンクを維持」ではPDFのページ内容や対話要素を保って再圧縮します。ただし電子署名付きPDFの書き換えで無効になります。「画像化して強く圧縮」では文字の選択・検索、リンク、フォーム、しおりなどは失われます。元のPDFは変更されません。パスワード付きPDFには対応していません。非常に大きいPDFでは端末のメモリが足りない場合があります。',
    processing: '処理中', failed: '処理できませんでした', choosePdf: 'PDFファイルを選択してください。', targetRange: '目標サイズは1〜500 MBで指定してください。',
    engine: 'PDF圧縮エンジンを準備中…', invalidPdf: 'PDFファイルとして読み込めませんでした。', largePdf: '大きなPDFを圧縮中', preserving: 'PDF構造を保って圧縮中 · {pass} / {count}', elapsed: 'ページ内の文字やリンクは維持されます。経過 {minutes}分{seconds}秒',
    outputFailed: '圧縮後のPDFを作成できませんでした。', canvasFailed: 'ブラウザで画像を作成できませんでした。', imageFailed: '画像を作成できませんでした。',
    page: '圧縮中 · {page} / {count} ページ', adjustment: '画質調整 {pass} / {count}', smaller: '{percent}%小さくなりました。{target}', reached: '目標サイズ以内です。', missed: '目標サイズには届きませんでした。', noSavings: 'このPDFは、この方法では小さくなりませんでした。',
    reading: 'PDFを読み込んでいます…', complete: '完了しました', cancelled: '中止しました', password: 'パスワード付きPDFは処理できません。', cancelling: '中止しています…', genericError: 'PDFを処理できませんでした。別のファイルか圧縮方式を試してください。', timeout: '圧縮に時間がかかりすぎました。小さなPDFか画像化方式を試してください。', memory: 'この端末のメモリが不足しているため、PDFを処理できません。'
  }
};

export function translate(language, key, params = {}) {
  const template = messages[selectLanguage(language)][key];
  if (template === undefined) throw new Error(`Missing translation: ${key}`);
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
}
