/**
 * Builds a self-contained continuous-scroll PDF viewer using pdf.js (CDN).
 * The PDF is passed as a base64 data URI so local sandbox files work reliably.
 *
 * Layout constants match packages/ui theme (centered page + annotation gutters).
 */
const PAGE_MAX_WIDTH = 820;
const GUTTER_MIN_WIDTH = 120;

export function buildPdfViewerHtml(pdfDataUri: string): string {
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
      position: relative;
      background: #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      max-width: 100%;
    }
    .page canvas {
      display: block;
    }
    /* pdf.js text layer essentials */
    .textLayer {
      position: absolute;
      inset: 0;
      overflow: hidden;
      opacity: 1;
      line-height: 1;
      text-size-adjust: none;
      forced-color-adjust: none;
      transform-origin: 0 0;
      z-index: 2;
      cursor: pointer;
    }
    .textLayer span,
    .textLayer br {
      color: transparent;
      position: absolute;
      white-space: pre;
      cursor: text;
      transform-origin: 0% 0%;
    }
    .textLayer .endOfContent {
      display: block;
      position: absolute;
      inset: 100% 0 0;
      z-index: -1;
      cursor: default;
      user-select: none;
    }
    mark.kv-word-highlight {
      background: rgba(0, 113, 227, 0.35);
      color: transparent;
      border-radius: 2px;
      padding: 0;
    }
    #status {
      color: #6E6E73;
      padding: 48px;
      text-align: center;
    }
  </style>
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
    let highlightMark = null;

    function post(msg) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }

    function normalizeWord(raw) {
      if (!raw) return '';
      return String(raw)
        .replace(/^[^a-zA-Z0-9']+/g, '')
        .replace(/[^a-zA-Z0-9']+$/g, '')
        .trim();
    }

    function clearHighlight() {
      if (!highlightMark) return;
      const parent = highlightMark.parentNode;
      if (!parent) {
        highlightMark = null;
        return;
      }
      while (highlightMark.firstChild) {
        parent.insertBefore(highlightMark.firstChild, highlightMark);
      }
      parent.removeChild(highlightMark);
      parent.normalize();
      highlightMark = null;
    }

    function highlightRange(range) {
      clearHighlight();
      try {
        const mark = document.createElement('mark');
        mark.className = 'kv-word-highlight';
        range.surroundContents(mark);
        highlightMark = mark;
      } catch (err) {
        // surroundContents can fail across element boundaries; ignore highlight.
        clearHighlight();
      }
    }

    function wordRangeFromPoint(x, y) {
      let range = null;
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(x, y);
      } else if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(x, y);
        if (pos && pos.offsetNode) {
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.collapse(true);
        }
      }
      if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) {
        return null;
      }

      const textNode = range.startContainer;
      const full = textNode.textContent || '';
      let start = range.startOffset;
      let end = range.startOffset;

      const isWordChar = (ch) => /[a-zA-Z0-9']/.test(ch);
      while (start > 0 && isWordChar(full[start - 1])) start -= 1;
      while (end < full.length && isWordChar(full[end])) end += 1;
      if (start === end) return null;

      const wordRange = document.createRange();
      wordRange.setStart(textNode, start);
      wordRange.setEnd(textNode, end);
      return { range: wordRange, word: full.slice(start, end) };
    }

    function onLayerClick(event, pageNumber) {
      event.preventDefault();
      event.stopPropagation();
      const hit = wordRangeFromPoint(event.clientX, event.clientY);
      if (!hit) return;
      const cleaned = normalizeWord(hit.word);
      if (!cleaned || !/[a-zA-Z]/.test(cleaned)) return;
      highlightRange(hit.range);
      post({ type: 'wordClick', word: cleaned, pageNumber });
    }

    async function renderPage(pdf, pageNum, maxWidth) {
      const page = await pdf.getPage(pageNum);
      const unscaled = page.getViewport({ scale: 1 });
      const scale = maxWidth / unscaled.width;
      const viewport = page.getViewport({ scale });

      const pageEl = document.createElement('div');
      pageEl.className = 'page';
      pageEl.style.width = viewport.width + 'px';
      pageEl.style.height = viewport.height + 'px';

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      pageEl.appendChild(canvas);

      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
      }).promise;

      const textContent = await page.getTextContent();
      const layer = document.createElement('div');
      layer.className = 'textLayer';
      layer.style.width = viewport.width + 'px';
      layer.style.height = viewport.height + 'px';
      layer.style.setProperty('--scale-factor', String(viewport.scale));
      layer.addEventListener('click', (e) => onLayerClick(e, pageNum));

      const textLayer = new pdfjsLib.TextLayer({
        textContentSource: textContent,
        container: layer,
        viewport,
      });
      await textLayer.render();

      pageEl.appendChild(layer);
      viewer.appendChild(pageEl);
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
