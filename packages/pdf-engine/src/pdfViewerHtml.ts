/**
 * Builds a self-contained continuous-scroll PDF viewer using pdf.js (CDN).
 * The PDF is passed as a base64 data URI so local sandbox files work reliably.
 *
 * Layout constants match packages/ui theme (centered page + annotation gutters).
 */
const PAGE_MAX_WIDTH = 820;
const GUTTER_MIN_WIDTH = 120;

export function buildPdfViewerHtml(pdfDataUri: string): string {
  // Escape for embedding inside a JS string literal
  const safeUri = pdfDataUri.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: #F5F5F7;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow-x: hidden;
      overflow-y: auto;
      scrollbar-gutter: stable;
    }
    html { height: 100%; }
    body { min-height: 100%; }
    #viewer {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 24px 0 48px;
      min-height: 100%;
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
    }
    .page {
      display: block;
      background: #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      max-width: 100%;
    }
    #status {
      color: #6E6E73;
      padding: 48px;
      text-align: center;
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs" type="module"></script>
</head>
<body>
  <div id="status">Loading PDF…</div>
  <div id="viewer"></div>
  <script type="module">
    import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs';
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs';

    const PAGE_MAX_WIDTH = ${PAGE_MAX_WIDTH};
    const GUTTER_MIN_WIDTH = ${GUTTER_MIN_WIDTH};
    const statusEl = document.getElementById('status');
    const viewer = document.getElementById('viewer');

    function post(msg) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }

    function targetPageWidth() {
      const viewport = document.documentElement.clientWidth;
      return Math.floor(
        Math.min(PAGE_MAX_WIDTH, Math.max(160, viewport - GUTTER_MIN_WIDTH * 2)),
      );
    }

    async function render() {
      try {
        const loadingTask = pdfjsLib.getDocument({ url: '${safeUri}' });
        const pdf = await loadingTask.promise;
        statusEl.style.display = 'none';
        post({ type: 'pageCount', count: pdf.numPages });

        const maxWidth = targetPageWidth();
        const sidePad = Math.max(
          GUTTER_MIN_WIDTH,
          Math.floor((document.documentElement.clientWidth - maxWidth) / 2),
        );
        viewer.style.paddingLeft = sidePad + 'px';
        viewer.style.paddingRight = sidePad + 'px';

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const unscaled = page.getViewport({ scale: 1 });
          const scale = maxWidth / unscaled.width;
          const viewport = page.getViewport({ scale });
          const cssWidth = Math.floor(viewport.width);
          const cssHeight = Math.floor(viewport.height);

          const canvas = document.createElement('canvas');
          canvas.className = 'page';
          canvas.width = cssWidth;
          canvas.height = cssHeight;
          canvas.style.width = cssWidth + 'px';
          canvas.style.height = cssHeight + 'px';
          viewer.appendChild(canvas);

          await page.render({
            canvasContext: canvas.getContext('2d'),
            viewport,
          }).promise;
        }
      } catch (err) {
        statusEl.textContent = 'Failed to load PDF';
        post({ type: 'error', message: String(err && err.message ? err.message : err) });
      }
    }

    render();
  </script>
</body>
</html>`;
}
