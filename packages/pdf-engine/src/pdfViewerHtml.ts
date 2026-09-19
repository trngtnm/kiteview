/**
 * Builds a self-contained continuous-scroll PDF viewer using pdf.js (CDN).
 * The PDF is passed as a base64 data URI so local sandbox files work reliably.
 *
 * Form overlays / heuristics / page capture are opt-in via window.__kv* APIs
 * injected after first paint — they never run during initial render.
 */
const PAGE_MAX_WIDTH = 820;

export function buildPdfViewerHtml(
  pdfDataUri: string,
  gptEndpointUrl = '',
  supabaseAnonKey = '',
): string {
  const safeUri = pdfDataUri.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const safeGptEndpoint = gptEndpointUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const safeAnonKey = supabaseAnonKey.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

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
      border-radius: 3px;
      pointer-events: auto;
      cursor: pointer;
      box-sizing: border-box;
      overflow: hidden;
    }
    .formField.selected {
      border-style: solid;
      border-width: 2px;
      background: rgba(0, 113, 227, 0.18);
      box-shadow: 0 0 0 2px rgba(0, 113, 227, 0.25);
    }
    .formField input {
      width: 100%;
      height: 100%;
      border: none;
      outline: none;
      background: transparent;
      font: inherit;
      font-size: 12px;
      padding: 2px 4px;
      color: #1d1d1f;
    }
    .formField input[type="checkbox"] {
      width: 70%;
      height: 70%;
      margin: auto;
      display: block;
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

    function postJsonWithXhr(url, headers, body) {
      return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('POST', url, true);
        Object.entries(headers).forEach(([key, value]) => request.setRequestHeader(key, value));
        request.onload = () => resolve({status: request.status, text: request.responseText});
        request.onerror = () => reject(new Error('GPT request could not reach the endpoint'));
        request.send(body);
      });
    }

    async function requestPhraseAnnotation(phrase, pageNumber) {
      if (!'${safeGptEndpoint}' || !'${safeAnonKey}') {
        post({type: 'phraseAnnotationError', phrase, message: 'GPT endpoint is not configured'});
        return;
      }
      const instruction = 'Explain the selected phrase in clear layman terms and briefly describe what it means in context.';
      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ${safeAnonKey}',
        apikey: '${safeAnonKey}',
      };
      const body = JSON.stringify({
        selection_text: phrase,
        text: phrase,
        page_number: pageNumber,
        annotation_type: 'paraphrase',
        instruction,
        prompt: instruction + '\\n\\nSelected phrase: ' + phrase,
        messages: [
          {role: 'system', content: instruction},
          {role: 'user', content: phrase},
        ],
      });
      try {
        let result;
        try {
          const response = await fetch('${safeGptEndpoint}', {method: 'POST', headers, body});
          result = {status: response.status, text: await response.text()};
        } catch {
          result = await postJsonWithXhr('${safeGptEndpoint}', headers, body);
        }
        const data = JSON.parse(result.text);
        if (result.status < 200 || result.status >= 300) throw new Error(data.message || 'GPT request failed (' + result.status + ')');
        const content = data.paraphrase || data.explanation || data.content || data.result || data.choices?.[0]?.message?.content;
        if (!content) throw new Error('The GPT endpoint returned no paraphrase content');
        post({type: 'phraseAnnotation', phrase, content: String(content).trim()});
      } catch (error) {
        post({type: 'phraseAnnotationError', phrase, message: String(error && error.message ? error.message : error)});
      }
    }

    let selectionTimer = null;
    document.addEventListener('selectionchange', () => {
      if (selectionTimer) clearTimeout(selectionTimer);
      selectionTimer = setTimeout(() => {
        const selection = window.getSelection();
        const phrase = selection ? selection.toString().trim() : '';
        if (!phrase || phrase.split(/\s+/).length < 2 || !selection?.anchorNode) {
          return;
        }
        const page = selection.anchorNode.parentElement?.closest('.page');
        const pageNumber = page ? Array.from(viewer.children).indexOf(page) + 1 : 0;
        if (pageNumber > 0) {
          post({type: 'phraseSelect', phrase, pageNumber});
        }
      }, 80);
    });
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
            el.style.left = (r.x || 0) * pageW + 'px';
            el.style.top = (r.y || 0) * pageH + 'px';
            el.style.width = Math.max(8, (r.w || 0) * pageW) + 'px';
            el.style.height = Math.max(8, (r.h || 0) * pageH) + 'px';

            el.addEventListener('mousedown', (e) => {
              e.stopPropagation();
              selectedFieldId = field.id;
              paintFormOverlays();
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
              input.placeholder = field.name || '';
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

    function itemBounds(item, viewport) {
      const t = item.transform || [1, 0, 0, 1, 0, 0];
      const x = t[4] / viewport.width;
      const fontH = Math.abs(item.height || t[3] || 10) / viewport.height;
      const w = Math.max(
        0.02,
        ((item.width != null ? item.width : (item.str || '').length * 5) /
          viewport.width),
      );
      const y = 1 - t[5] / viewport.height - fontH;
      return {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
        w: Math.max(0.01, Math.min(1 - x, w)),
        h: Math.max(0.012, Math.min(0.08, fontH * 1.4)),
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
      return Math.abs(ay - by) < Math.max(a.h, b.h) * 0.85;
    }

    function tryPushField(fields, pageNumber, idxRef, label, type, rect) {
      if (!rect || !label) return false;
      if (rect.w < 0.04 || rect.h < 0.008) return false;
      const candidate = {
        id: 'heur_' + pageNumber + '_' + idxRef.n,
        name: label,
        type: type || inferFieldType(label),
        pageNumber,
        rectNorm: {
          x: Math.max(0, Math.min(0.98, rect.x)),
          y: Math.max(0, Math.min(0.98, rect.y)),
          w: Math.max(0.04, Math.min(0.95, rect.w)),
          h: Math.max(0.012, Math.min(0.1, rect.h)),
        },
        source: 'heuristic',
      };
      const overlaps = fields.some(
        (f) =>
          f.pageNumber === pageNumber &&
          rectsOverlap(f.rectNorm, candidate.rectNorm, 0.012),
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
          const str = item.str.trim();
          const b = bounds[i];

          if (/^[☐□\\[\\s\\]\\(\\)\\.]*$/.test(str) && /[☐□\\[]/.test(str)) {
            tryPushField(
              fields,
              pageNumber,
              idxRef,
              'Checkbox ' + (idxRef.n + 1),
              'checkbox',
              {
                x: b.x,
                y: b.y,
                w: Math.max(b.w, 0.025),
                h: Math.max(b.h, 0.018),
              },
            );
            continue;
          }

          const labelMatch = str.match(
            /^(.{1,60}?)\\s*[:]?\\s*([_.…\\-]{2,}|\\.{3,})\\s*$/,
          );
          const colonLabel = str.match(/^(.{1,60}?)\\s*:\\s*$/);
          const trailingColon = /:\\s*$/.test(str) && !labelMatch;

          if (labelMatch) {
            const label = cleanLabel(labelMatch[1]);
            const blankRatio = Math.min(
              0.6,
              Math.max(0.16, (labelMatch[2] || '').length * 0.011),
            );
            tryPushField(fields, pageNumber, idxRef, label, null, {
              x: Math.min(0.92, b.x + Math.min(b.w * 0.4, 0.25)),
              y: b.y,
              w: blankRatio,
              h: Math.max(b.h, 0.018),
            });
            continue;
          }

          if (colonLabel || trailingColon) {
            const label = cleanLabel(str.replace(/:\\s*$/, ''));
            let usedNeighbor = false;
            for (let j = i + 1; j < Math.min(i + 6, items.length); j++) {
              const nb = bounds[j];
              if (!sameLine(b, nb)) break;
              if (nb.x < b.x + b.w - 0.01) continue;
              const nstr = items[j].str.trim();
              if (isBlankish(nstr)) {
                usedNeighbor = tryPushField(
                  fields,
                  pageNumber,
                  idxRef,
                  label,
                  null,
                  {
                    x: nb.x,
                    y: Math.min(b.y, nb.y),
                    w: Math.max(nb.w, 0.18),
                    h: Math.max(b.h, nb.h, 0.018),
                  },
                );
                break;
              }
              if (nstr.length <= 2 && !/[a-zA-Z0-9]/.test(nstr)) {
                usedNeighbor = tryPushField(
                  fields,
                  pageNumber,
                  idxRef,
                  label,
                  null,
                  {
                    x: Math.min(0.9, b.x + b.w + 0.008),
                    y: b.y - 0.002,
                    w: Math.min(0.5, Math.max(0.18, nb.x - (b.x + b.w))),
                    h: Math.max(b.h, 0.02),
                  },
                );
                break;
              }
            }
            if (!usedNeighbor) {
              tryPushField(fields, pageNumber, idxRef, label, null, {
                x: Math.min(0.9, b.x + b.w + 0.01),
                y: b.y - 0.002,
                w: Math.min(0.45, Math.max(0.18, 0.88 - (b.x + b.w))),
                h: Math.max(b.h, 0.02),
              });
            }
            continue;
          }

          if (isBlankish(str)) {
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
            tryPushField(fields, pageNumber, idxRef, label, null, {
              x: b.x,
              y: b.y,
              w: Math.max(b.w, 0.16),
              h: Math.max(b.h, 0.018),
            });
          }
        }
      });

      return fields;
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
        viewport: { width: viewport.width, height: viewport.height },
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
        paintFormOverlays();
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
      paintFormOverlays();
    };

    window.__kvSetSelectedField = function (id) {
      selectedFieldId = id || null;
      paintFormOverlays();
    };

    window.__kvSetFieldValue = function (id, value) {
      if (!id) return;
      fieldValues[id] = value == null ? '' : String(value);
      paintFormOverlays();
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
