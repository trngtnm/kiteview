# Vendored pdf.js (4.8.69)

Copied from `pdfjs-dist/build`. Served in dev by Metro middleware at:

- `http://localhost:8081/kiteview-pdfjs/pdf.min.mjs`
- `http://localhost:8081/kiteview-pdfjs/pdf.worker.min.mjs`

(see `apps/macos/metro.config.js`)

Refresh after upgrading pdfjs-dist:

```bash
cp ../../node_modules/pdfjs-dist/build/pdf.min.mjs ./pdf.min.mjs
cp ../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs ./pdf.worker.min.mjs
```
