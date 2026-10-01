# Local Shrink PDF

A browser-based PDF compressor that runs entirely on your device. Download and open the generated [`index.html`](index.html) in Chrome or Edge, or host it as a static page. No account, installation, server-side processing, or file upload is required. The interface uses Japanese when the browser's primary language is Japanese and English otherwise.

## Use

1. Open `index.html` in your browser, or visit the GitHub Pages site.
2. Select or drop one PDF, choose a target size (5 MB by default) and compression method, and click **Compress PDF**.
3. Check the resulting size, open the PDF preview in an overlay if desired, and save it.

**Preserve text and links** recompresses the PDF structure. Searchable and copyable text, links, forms, and bookmarks remain available, though savings depend on the document. PDFs of at least 100 MB use one quality pass to limit processing time and memory use. **Convert pages to images** can reduce size further, but it removes selectable text, links, forms, and bookmarks. Both methods invalidate existing digital signatures. Password-protected PDFs are unsupported. The original file is never changed, and reaching the target size is not guaranteed.

Processing uses browser memory and can take a long time or fail for very large PDFs. Closing the tab stops processing. Files stay in the browser; the app makes no upload requests.

## Build and test

To modify the app, install the development dependencies and rebuild the standalone HTML:

```sh
npm ci
npm test
npm run build
```

The source is in `src/`. The generated `index.html` includes the JavaScript, WebAssembly, worker code, and third-party notices, so it can be shared as one file. `npm run test:e2e` runs an optional browser test when a local Chrome or Edge installation is available.

## Publish on GitHub Pages

The [Pages workflow](.github/workflows/pages.yml) builds and tests the app, then publishes only `index.html` and `LICENSE`. PDFs in this working directory are excluded from Git by `.gitignore` and are never part of the Pages artifact.

1. Create a GitHub repository and push this project to its `main` branch.
2. In the repository settings, select **Pages → Build and deployment → Source: GitHub Actions**.
3. Run the **Deploy GitHub Pages** workflow, or push to `main`. GitHub will show the site URL in the deployment.

The site is static and works at a repository subpath because all runtime assets are embedded. Opening the GitHub Pages site initially requires an internet connection. To use the app completely offline, download `index.html` beforehand and open that local file. Compression itself does not require network access.

## License

This project is licensed under the [MIT License](LICENSE). It bundles [QPDF](https://github.com/qpdf/qpdf), [PDF.js](https://github.com/mozilla/pdf.js), and [pdf-lib](https://github.com/Hopding/pdf-lib); their notices are embedded in the generated HTML.
