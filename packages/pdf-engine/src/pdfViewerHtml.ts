/**
 * Builds a self-contained continuous-scroll PDF viewer using pdf.js (CDN).
 * The PDF is passed as a base64 data URI so local sandbox files work reliably.
 *
 * Form overlays / heuristics / page capture are opt-in via window.__kv* APIs
 * injected after first paint — they never run during initial render.
 */
const PAGE_MAX_WIDTH = 820;

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
    .page canvas { display: block; }
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
    .formOverlay {
      position: absolute;
      inset: 0;
      z-index: 3;
      pointer-events: none;
    }
    .formField {
      position: absolute;
      border: 1.5px dashed rgba(0, 113, 227, 0.85);
      background: rgba(0, 113, 227, 0.08);
      border-radius: 2px;
      pointer-events: auto;
      cursor: pointer;
      box-sizing: border-box;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: stretch;
    }
    .formField.selected {
      border-style: solid;
      border-width: 2px;
      background: rgba(0, 113, 227, 0.18);
      box-shadow: inset 0 0 0 1px rgba(0, 113, 227, 0.35);
    }
    .formField input[type="text"] {
      width: 100%;
      height: 100%;
      border: none;
      outline: none;
      background: transparent;
      font: inherit;
      font-size: inherit;
      line-height: 1.1;
      padding: 0 2px;
      margin: 0;
      color: #1d1d1f;
      box-sizing: border-box;
    }
    .formField input[type="checkbox"] {
      width: 70%;
      height: 70%;
      margin: auto;
      display: block;
      flex: none;
      accent-color: #0071e3;
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
    const statusEl = document.getElementById('status');
    const viewer = document.getElementById('viewer');
    let highlightMark = null;
    let pdfDoc = null;
    let formFields = [];
    let selectedFieldId = null;
    const fieldValues = {};
    const pageEls = new Map();
    const pageTextData = new Map();

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

    function paintFormOverlays() {
      pageEls.forEach((pageEl) => {
        let overlay = pageEl.querySelector('.formOverlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'formOverlay';
          pageEl.appendChild(overlay);
        }
        overlay.innerHTML = '';
        const pageNum = Number(pageEl.dataset.pageNumber);
        const pageW = pageEl.clientWidth || pageEl.offsetWidth;
        const pageH = pageEl.clientHeight || pageEl.offsetHeight;
        if (!pageW || !pageH) return;

        formFields
          .filter((f) => f.pageNumber === pageNum)
          .forEach((field) => {
            const el = document.createElement('div');
            el.className =
              'formField' + (field.id === selectedFieldId ? ' selected' : '');
            el.dataset.fieldId = field.id;
            const r = field.rectNorm || {};
            const boxH = Math.max(8, (r.h || 0) * pageH);
            el.style.left = (r.x || 0) * pageW + 'px';
            el.style.top = (r.y || 0) * pageH + 'px';
            el.style.width = Math.max(8, (r.w || 0) * pageW) + 'px';
            el.style.height = boxH + 'px';
            const fontPx = Math.max(8, Math.min(18, boxH * 0.7));
            el.style.fontSize = fontPx + 'px';

            el.addEventListener('mousedown', (e) => {
              e.stopPropagation();
              selectedFieldId = field.id;
              schedulePaintFormOverlays();
              post({ type: 'formFieldClick', id: field.id });
            });

            const value = fieldValues[field.id] ?? '';
            if (field.type === 'checkbox') {
              const input = document.createElement('input');
              input.type = 'checkbox';
              input.checked = value === 'true' || value === '1' || value === 'yes';
              input.addEventListener('change', (e) => {
                e.stopPropagation();
                const next = input.checked ? 'true' : 'false';
                fieldValues[field.id] = next;
                post({ type: 'formFieldChange', id: field.id, value: next });
              });
              el.appendChild(input);
            } else if (field.type !== 'signature') {
              const input = document.createElement('input');
              input.type = 'text';
              input.value = value;
              input.placeholder = '';
              input.addEventListener('input', (e) => {
                e.stopPropagation();
                fieldValues[field.id] = input.value;
                post({
                  type: 'formFieldChange',
                  id: field.id,
                  value: input.value,
                });
              });
              input.addEventListener('mousedown', (e) => e.stopPropagation());
              el.appendChild(input);
            }

            overlay.appendChild(el);
          });
      });
    }

    function schedulePaintFormOverlays() {
      requestAnimationFrame(() => {
        paintFormOverlays();
      });
    }

    function inferFieldType(label) {
      const lower = (label || '').toLowerCase();
      if (/sign|signature|initial/.test(lower)) return 'signature';
      if (/check|agree|opt.?in|\\byes\\b|\\bno\\b/.test(lower)) return 'checkbox';
      return 'text';
    }

    function cleanLabel(raw) {
      return String(raw || '')
        .replace(/[:.\\-_]+$/g, '')
        .replace(/^[:.\\-_]+/g, '')
        .replace(/\\s+/g, ' ')
        .replace(/\\*+/g, '')
        .trim()
        .slice(0, 80);
    }

    function rectsOverlap(a, b, pad) {
      const p = pad == null ? 0.01 : pad;
      return !(
        a.x + a.w - p <= b.x ||
        b.x + b.w - p <= a.x ||
        a.y + a.h - p <= b.y ||
        b.y + b.h - p <= a.y
      );
    }

    /**
     * Page-normalized top-left bounds for a pdf.js text item, using the
     * same viewport transform as the rendered canvas / text layer.
     */
    function itemBounds(item, viewport) {
      const vpTransform = viewport.transform || [1, 0, 0, 1, 0, 0];
      const itemTransform = item.transform || [1, 0, 0, 1, 0, 0];
      const m = pdfjsLib.Util.transform(vpTransform, itemTransform);
      const pageW = viewport.width;
      const pageH = viewport.height;
      if (!pageW || !pageH) {
        return { x: 0, y: 0, w: 0.02, h: 0.02 };
      }

      const fontHeightPx = Math.hypot(m[2], m[3]) || Math.abs(item.height || 10);
      const scaleX = Math.hypot(m[0], m[1]) || 1;
      const itemScaleX = Math.hypot(itemTransform[0], itemTransform[1]) || 1;
      const widthPx =
        item.width != null && item.width > 0
          ? item.width * (scaleX / itemScaleX)
          : Math.max(4, (item.str || '').length * fontHeightPx * 0.5);

      // m[4], m[5] = baseline origin in viewport (top-left) coords.
      const left = m[4];
      const top = m[5] - fontHeightPx * 0.8;
      const x = left / pageW;
      const y = top / pageH;
      const w = widthPx / pageW;
      const h = (fontHeightPx * 1.05) / pageH;

      return {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
        w: Math.max(0.008, Math.min(1 - Math.max(0, x), w)),
        h: Math.max(0.01, Math.min(0.08, h)),
      };
    }

    /** Blank rect for underscore/dot run inside a single text item. */
    function blankRectFromSpan(bounds, fullStr, blankPart) {
      const full = String(fullStr || '');
      const blank = String(blankPart || '');
      if (!full.length || !blank.length || bounds.w <= 0) {
        return null;
      }
      let start = full.indexOf(blank);
      if (start < 0) {
        const m = full.match(/[_.…\\-]{2,}|\\.{3,}/);
        if (!m) return null;
        start = m.index || 0;
        return blankRectFromSpan(bounds, full, m[0]);
      }
      const total = full.length;
      const startFrac = start / total;
      const blankFrac = Math.max(blank.length / total, 0.08);
      return {
        x: bounds.x + bounds.w * startFrac,
        y: bounds.y,
        w: Math.max(0.04, bounds.w * blankFrac),
        h: Math.max(bounds.h, 0.014),
      };
    }

    /** Gap to the right of a label, clipped by the next same-line item. */
    function gapRectAfterLabel(labelBounds, nextBounds) {
      const gapStart = labelBounds.x + labelBounds.w + 0.004;
      const gapEnd =
        nextBounds && nextBounds.x > gapStart + 0.05
          ? nextBounds.x - 0.004
          : Math.max(gapStart + 0.2, 0.88);
      const w = Math.min(0.92, gapEnd) - gapStart;
      if (w < 0.05) return null;
      return {
        x: gapStart,
        y: labelBounds.y,
        w,
        h: Math.max(labelBounds.h, 0.014),
      };
    }

    function isBlankish(str) {
      const s = String(str || '').trim();
      if (!s) return false;
      if (/[☐□☑✓✔\\[\\]\\(\\)]/.test(s) && s.replace(/\\s/g, '').length <= 4) {
        return /[☐□\\[\\(]/.test(s);
      }
      const stripped = s.replace(/[_.…\\-\\s.]/g, '');
      const underscore = (s.match(/[_.…]{2,}|_{2,}|…{2,}|\\.{3,}/g) || []).join('');
      return underscore.length >= 2 && stripped.length < 10;
    }

    function sameLine(a, b) {
      const ay = a.y + a.h / 2;
      const by = b.y + b.h / 2;
      return Math.abs(ay - by) < Math.max(a.h, b.h, 0.012) * 0.9;
    }

    function tryPushField(fields, pageNumber, idxRef, label, type, rect) {
      if (!rect || !label) return false;
      const minW = type === 'checkbox' ? 0.012 : 0.035;
      if (rect.w < minW || rect.h < 0.008) return false;
      const candidate = {
        id: 'heur_' + pageNumber + '_' + idxRef.n,
        name: label,
        type: type || inferFieldType(label),
        pageNumber,
        rectNorm: {
          x: Math.max(0, Math.min(0.98, rect.x)),
          y: Math.max(0, Math.min(0.98, rect.y)),
          w: Math.max(minW, Math.min(0.95, rect.w)),
          h: Math.max(0.01, Math.min(0.08, rect.h)),
        },
        source: 'heuristic',
      };
      const overlaps = fields.some(
        (f) =>
          f.pageNumber === pageNumber &&
          rectsOverlap(f.rectNorm, candidate.rectNorm, 0.008),
      );
      if (overlaps) return false;
      fields.push(candidate);
      idxRef.n += 1;
      return true;
    }

    function detectHeuristicFields() {
      const fields = [];
      const idxRef = { n: 0 };

      pageTextData.forEach((data, pageNumber) => {
        const items = (data.items || []).filter(
          (it) => it && typeof it.str === 'string' && it.str.trim(),
        );
        const vp = data.viewport;
        if (!vp || !items.length) return;
        const bounds = items.map((it) => itemBounds(it, vp));

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const str = item.str;
          const trimmed = str.trim();
          const b = bounds[i];

          if (
            /^[☐□\\[\\s\\]\\(\\)\\.]*$/.test(trimmed) &&
            /[☐□\\[]/.test(trimmed)
          ) {
            tryPushField(
              fields,
              pageNumber,
              idxRef,
              'Checkbox ' + (idxRef.n + 1),
              'checkbox',
              {
                x: b.x,
                y: b.y,
                w: Math.max(b.w, 0.018),
                h: Math.max(b.h, 0.016),
              },
            );
            continue;
          }

          const labelMatch = trimmed.match(
            /^(.{1,60}?)\\s*[:]?\\s*([_.…\\-]{2,}|\\.{3,})\\s*$/,
          );
          const colonLabel = trimmed.match(/^(.{1,60}?)\\s*:\\s*$/);
          const trailingColon = /:\\s*$/.test(trimmed) && !labelMatch;

          if (labelMatch) {
            const label = cleanLabel(labelMatch[1]);
            const blankPart = labelMatch[2];
            const rect =
              blankRectFromSpan(b, trimmed, blankPart) ||
              gapRectAfterLabel(b, null);
            if (rect) {
              tryPushField(fields, pageNumber, idxRef, label, null, rect);
            }
            continue;
          }

          if (colonLabel || trailingColon) {
            const label = cleanLabel(trimmed.replace(/:\\s*$/, ''));
            let usedNeighbor = false;
            let nextSameLine = null;
            for (let j = i + 1; j < Math.min(i + 8, items.length); j++) {
              const nb = bounds[j];
              if (!sameLine(b, nb)) break;
              if (nb.x + nb.w <= b.x + b.w * 0.5) continue;
              if (!nextSameLine && nb.x >= b.x + b.w - 0.02) {
                nextSameLine = nb;
              }
              const nstr = items[j].str.trim();
              if (isBlankish(nstr)) {
                // Use the blank item's measured bounds exactly.
                usedNeighbor = tryPushField(
                  fields,
                  pageNumber,
                  idxRef,
                  label,
                  null,
                  {
                    x: nb.x,
                    y: nb.y,
                    w: Math.max(nb.w, 0.05),
                    h: Math.max(nb.h, b.h * 0.9, 0.014),
                  },
                );
                break;
              }
            }
            if (!usedNeighbor) {
              const gap = gapRectAfterLabel(b, nextSameLine);
              if (gap) {
                tryPushField(fields, pageNumber, idxRef, label, null, gap);
              }
            }
            continue;
          }

          if (isBlankish(trimmed)) {
            let label = 'Blank ' + (idxRef.n + 1);
            for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
              const pb = bounds[j];
              if (!sameLine(pb, b)) break;
              const pstr = items[j].str.trim();
              if (isBlankish(pstr)) continue;
              if (/[a-zA-Z]/.test(pstr) && pstr.length <= 60) {
                label = cleanLabel(pstr.replace(/:\\s*$/, '')) || label;
                break;
              }
            }
            // Prefer underscore substring if mixed; else full item box.
            const span = trimmed.match(/[_.…\\-]{2,}|\\.{3,}/);
            const rect = span
              ? blankRectFromSpan(b, trimmed, span[0]) || b
              : { x: b.x, y: b.y, w: b.w, h: Math.max(b.h, 0.014) };
            tryPushField(fields, pageNumber, idxRef, label, null, rect);
            continue;
          }

          // Drawn-line blanks (no underscore glyphs): short left labels with
          // a wide empty gap to the right — place the field in that gap.
          if (looksLikeFieldLabel(trimmed) && b.x < 0.45) {
            let nextSameLine = null;
            for (let j = 0; j < items.length; j++) {
              if (j === i) continue;
              const nb = bounds[j];
              if (!sameLine(b, nb)) continue;
              if (nb.x <= b.x + b.w - 0.01) continue;
              if (!nextSameLine || nb.x < nextSameLine.x) {
                nextSameLine = nb;
              }
            }
            const gap = gapRectAfterLabel(b, nextSameLine);
            if (gap && gap.w >= 0.14) {
              tryPushField(fields, pageNumber, idxRef, cleanLabel(trimmed), null, gap);
            }
          }
        }
      });

      return fields;
    }

    function looksLikeFieldLabel(str) {
      const s = String(str || '').trim();
      if (s.length < 2 || s.length > 55) return false;
      if (/^[•·\\-]/.test(s)) return false;
      if (/[.!?]$/.test(s) && s.length > 25) return false;
      // Long prose sentences
      if ((s.match(/\\s+/g) || []).length >= 8) return false;
      const exclude =
        /^(CLIENT DETAILS|COMPULSORY SECTION|BUSINESS APPLICATION|FILLABLE FORM EXAMPLE|NOTES?|INSTRUCTIONS?)$/i;
      if (exclude.test(s)) return false;
      if (/\\*$/.test(s)) return true;
      if (
        /(NUMBER|NAME|EMAIL|CODE|CELL|PHONE|SURNAME|INCOME|INVESTMENT|ADDRESS|DATE|SIGNATURE|ENTITY|REGISTRATION|PURPOSE)/i.test(
          s,
        )
      ) {
        return true;
      }
      // Short mostly-uppercase labels (e.g. ENTITY NUMBER)
      const letters = s.replace(/[^a-zA-Z]/g, '');
      if (!letters) return false;
      const upperCount = (letters.match(/[A-Z]/g) || []).length;
      return upperCount / letters.length >= 0.7 && s.length <= 40;
    }

    async function renderPage(pdf, pageNum, maxWidth) {
      const page = await pdf.getPage(pageNum);
      const unscaled = page.getViewport({ scale: 1 });
      const scale = maxWidth / unscaled.width;
      const viewport = page.getViewport({ scale });

      const pageEl = document.createElement('div');
      pageEl.className = 'page';
      pageEl.dataset.pageNumber = String(pageNum);
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
      pageTextData.set(pageNum, {
        items: textContent.items || [],
        viewport: {
          width: viewport.width,
          height: viewport.height,
          scale: viewport.scale,
          transform: viewport.transform.slice(),
        },
      });

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
      pageEls.set(pageNum, pageEl);

      if (formFields.length) {
        schedulePaintFormOverlays();
      }

      post({ type: 'pageReady', pageNumber: pageNum });
    }

    function targetPageWidth() {
      const available = document.documentElement.clientWidth - 8;
      return Math.max(120, Math.min(PAGE_MAX_WIDTH, available));
    }

    async function render() {
      try {
        const loadingTask = pdfjsLib.getDocument({ url: '${safeUri}' });
        pdfDoc = await loadingTask.promise;
        statusEl.style.display = 'none';
        post({ type: 'pageCount', count: pdfDoc.numPages });

        const maxWidth = targetPageWidth();
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          await renderPage(pdfDoc, pageNum, maxWidth);
        }
      } catch (err) {
        statusEl.textContent = 'Failed to load PDF';
        post({
          type: 'error',
          message: String(err && err.message ? err.message : err),
        });
      }
    }

    window.__kvSetFormFields = function (fields) {
      formFields = Array.isArray(fields) ? fields : [];
      schedulePaintFormOverlays();
    };

    window.__kvSetSelectedField = function (id) {
      selectedFieldId = id || null;
      schedulePaintFormOverlays();
    };

    window.__kvSetFieldValue = function (id, value) {
      if (!id) return;
      fieldValues[id] = value == null ? '' : String(value);
      schedulePaintFormOverlays();
    };

    window.__kvRunHeuristicDetect = function () {
      try {
        const fields = detectHeuristicFields();
        post({ type: 'heuristicFields', fields });
      } catch (err) {
        post({
          type: 'heuristicFields',
          fields: [],
          message: String(err && err.message ? err.message : err),
        });
      }
    };

    window.__kvCapturePagesForDetect = async function (maxPages) {
      try {
        const limit = Math.max(1, Math.min(3, Number(maxPages) || 1));
        const pages = [];
        for (let n = 1; n <= Math.min(limit, pageEls.size); n++) {
          const pageEl = pageEls.get(n);
          if (!pageEl) continue;
          const canvas = pageEl.querySelector('canvas');
          if (!canvas) continue;
          const maxW = 720;
          let out = canvas;
          if (canvas.width > maxW) {
            const scale = maxW / canvas.width;
            const tmp = document.createElement('canvas');
            tmp.width = Math.round(canvas.width * scale);
            tmp.height = Math.round(canvas.height * scale);
            tmp.getContext('2d').drawImage(canvas, 0, 0, tmp.width, tmp.height);
            out = tmp;
          }
          const dataUrl = out.toDataURL('image/jpeg', 0.55);
          const comma = dataUrl.indexOf(',');
          pages.push({
            pageNumber: n,
            imageBase64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
            mimeType: 'image/jpeg',
          });
        }
        post({ type: 'formPageImages', pages });
      } catch (err) {
        post({
          type: 'formPageImages',
          pages: [],
          message: String(err && err.message ? err.message : err),
        });
      }
    };

    render();
  </script>
</body>
</html>`;
}
