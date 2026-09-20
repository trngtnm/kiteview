/**
 * Builds a self-contained continuous-scroll PDF viewer using pdf.js (CDN).
 * The PDF is passed as a base64 data URI so local sandbox files work reliably.
 *
 * Form overlays / heuristics / page capture are opt-in via window.__kv* APIs
 * injected after first paint — they never run during initial render.
 * Phrase annotation GPT calls happen in React Native, not in this HTML.
 */
const PAGE_MAX_WIDTH = 820;

export function buildPdfViewerHtml(
  pdfDataUri: string,
  colorScheme: 'light' | 'dark' = 'light',
): string {
  const safeUri = pdfDataUri.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const pageBg = scheme === 'dark' ? '#0F1218' : '#F5F5F7';

  return `<!DOCTYPE html>
<html data-scheme="${scheme}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: ${pageBg};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow-x: visible;
      overflow-y: auto;
      scrollbar-gutter: stable;
    }
    html[data-scheme="light"],
    html[data-scheme="light"] body {
      background: #F5F5F7;
    }
    html[data-scheme="dark"],
    html[data-scheme="dark"] body {
      background: #0F1218;
    }
    html { height: 100%; }
    body { min-height: 100%; }
    #viewer {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 24px 148px 48px;
      min-height: 100%;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow-x: visible;
    }
    .page {
      display: block;
      position: relative;
      background: #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }
    /* Visible so pinned margin notes (outside the page box) still show. */
    .page {
      overflow: visible;
    }
    html[data-scheme="dark"] .page {
      box-shadow: 0 1px 8px rgba(0,0,0,0.45);
    }
    .page canvas {
      display: block;
      /* Natural bitmap size; must match page + textLayer CSS pixels. */
    }
    .textLayer {
      position: absolute;
      left: 0;
      top: 0;
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
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }
    .pinOverlay {
      position: absolute;
      inset: 0;
      z-index: 4;
      pointer-events: none;
      overflow: visible;
    }
    .pinnedHighlight {
      position: absolute;
      background: rgba(255, 196, 0, 0.38);
      border-radius: 2px;
      pointer-events: auto;
      cursor: pointer;
      box-sizing: border-box;
    }
    .pinnedHighlight.selected {
      background: rgba(255, 168, 0, 0.55);
      box-shadow: 0 0 0 1px rgba(200, 120, 0, 0.45);
    }
    .pinnedNote {
      position: absolute;
      width: 128px;
      max-width: 34%;
      padding: 8px 10px;
      border-radius: 8px;
      background: #FFFDF7;
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
      pointer-events: auto;
      cursor: pointer;
      box-sizing: border-box;
      z-index: 5;
    }
    html[data-scheme="dark"] .pinnedNote {
      background: #1C2433;
      border-color: rgba(255, 255, 255, 0.12);
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
    }
    html[data-scheme="dark"] .pinnedNote .pinPhrase {
      color: #E8EDF5;
    }
    html[data-scheme="dark"] .pinnedNote .pinBody {
      color: #9AA8BC;
    }
    .pinnedNote.selected,
    .pinnedNote.extended {
      width: 168px;
      max-width: 42%;
      border-width: 2px;
      border-color: #79AFFF;
      box-shadow: 0 0 0 1px rgba(45, 127, 249, 0.2), 0 2px 12px rgba(45, 127, 249, 0.18);
      z-index: 6;
    }
    html[data-scheme="dark"] .pinnedNote.selected,
    html[data-scheme="dark"] .pinnedNote.extended {
      border-color: #3D6FB0;
      box-shadow: 0 0 0 1px rgba(75, 145, 231, 0.28), 0 2px 14px rgba(0, 0, 0, 0.4);
    }
    .pinnedNote .pinPhrase {
      font: 600 11px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1d1d1f;
      margin: 0 0 4px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .pinnedNote .pinBody {
      font: 400 11px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #3a3a3c;
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    /* Full annotation next to the highlight — scrolls with the page. */
    .pinnedNote.extended .pinPhrase,
    .pinnedNote.selected .pinPhrase,
    .pinnedNote.extended .pinBody,
    .pinnedNote.selected .pinBody {
      display: block;
      -webkit-line-clamp: unset;
      overflow: visible;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .formOverlay {
      position: absolute;
      inset: 0;
      z-index: 3;
      pointer-events: none;
    }
    .formField {
      position: absolute;
      border: 1.5px dashed rgba(0, 113, 227, 0.9);
      background: rgba(0, 113, 227, 0.1);
      border-radius: 3px;
      pointer-events: auto;
      cursor: text;
      box-sizing: border-box;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: stretch;
    }
    .formField.selected {
      border-style: solid;
      border-width: 2px;
      background: rgba(0, 113, 227, 0.2);
      box-shadow: inset 0 0 0 1px rgba(0, 113, 227, 0.4);
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
      padding: 0 4px;
      margin: 0;
      color: #1d1d1f;
      box-sizing: border-box;
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
    let pinnedAnnotations = [];
    let selectedPinnedId = null;
    let activeAnnotation = null;
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

    function isWordChar(ch) {
      return /[a-zA-Z0-9']/.test(ch);
    }

    /** Expand a range so it does not start/end mid-word within its text nodes. */
    function expandRangeToWordBoundaries(range) {
      const out = range.cloneRange();
      try {
        if (out.startContainer.nodeType === Node.TEXT_NODE) {
          const text = out.startContainer.textContent || '';
          let s = out.startOffset;
          while (s > 0 && isWordChar(text[s - 1])) s -= 1;
          out.setStart(out.startContainer, s);
        }
        if (out.endContainer.nodeType === Node.TEXT_NODE) {
          const text = out.endContainer.textContent || '';
          let e = out.endOffset;
          // If the range ended mid-word, include the rest of the word.
          while (e < text.length && isWordChar(text[e])) e += 1;
          // If end sits on a boundary right after a partial word, already covered.
          out.setEnd(out.endContainer, e);
        }
      } catch {
        return range;
      }
      return out;
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
      while (start > 0 && isWordChar(full[start - 1])) start -= 1;
      while (end < full.length && isWordChar(full[end])) end += 1;
      if (start === end) return null;
      const wordRange = document.createRange();
      wordRange.setStart(textNode, start);
      wordRange.setEnd(textNode, end);
      return { range: wordRange, word: full.slice(start, end) };
    }

    let pointerDown = null;
    document.addEventListener('mousedown', (event) => {
      pointerDown = { x: event.clientX, y: event.clientY };
    }, true);
    document.addEventListener('mouseup', () => {
      // Keep pointerDown until click handler runs; clear on next tick if no click.
      setTimeout(() => {
        pointerDown = null;
      }, 0);
    }, true);

    function onLayerClick(event, pageNumber) {
      event.preventDefault();
      event.stopPropagation();

      // Multi-word drag/select → annotation path only; never define the last word.
      const selection = window.getSelection();
      const selectedText = selection ? selection.toString().trim() : '';
      if (selectedText && selectedText.split(/\\s+/).filter(Boolean).length >= 2) {
        return;
      }
      if (
        pointerDown &&
        (Math.abs(event.clientX - pointerDown.x) > 5 ||
          Math.abs(event.clientY - pointerDown.y) > 5)
      ) {
        pointerDown = null;
        return;
      }
      pointerDown = null;

      const hit = wordRangeFromPoint(event.clientX, event.clientY);
      if (!hit) return;
      const cleaned = normalizeWord(hit.word);
      if (!cleaned || !/[a-zA-Z]/.test(cleaned)) return;
      highlightRange(hit.range);
      post({ type: 'wordClick', word: cleaned, pageNumber });
    }

    function selectionContext(selection, phrase) {
      try {
        if (!selection || selection.rangeCount === 0) return '';
        const range = selection.getRangeAt(0);
        const page = range.commonAncestorContainer.nodeType === 1
          ? range.commonAncestorContainer.closest('.page')
          : range.commonAncestorContainer.parentElement?.closest('.page');
        if (!page) return '';
        const layer = page.querySelector('.textLayer');
        if (!layer) return '';
        const full = (layer.innerText || layer.textContent || '').replace(/\\s+/g, ' ').trim();
        if (!full) return '';
        const needle = phrase.replace(/\\s+/g, ' ').trim();
        const idx = full.indexOf(needle);
        if (idx < 0) {
          return full.slice(0, 500);
        }
        const start = Math.max(0, idx - 180);
        const end = Math.min(full.length, idx + needle.length + 180);
        return full.slice(start, end).trim().slice(0, 500);
      } catch {
        return '';
      }
    }

    function selectionRectNorm(selection, pageEl) {
      try {
        if (!selection || selection.rangeCount === 0 || !pageEl) return null;
        const range = selection.getRangeAt(0);
        const pageRect = pageEl.getBoundingClientRect();
        const pageW = pageRect.width || pageEl.clientWidth;
        const pageH = pageRect.height || pageEl.clientHeight;
        if (!pageW || !pageH) return null;

        // Union all client rects so multi-span / multi-line selections are not
        // clipped to a partial first-line box.
        const list = range.getClientRects();
        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        let any = false;
        for (let i = 0; i < list.length; i++) {
          const r = list[i];
          if (!r.width && !r.height) continue;
          any = true;
          left = Math.min(left, r.left);
          top = Math.min(top, r.top);
          right = Math.max(right, r.right);
          bottom = Math.max(bottom, r.bottom);
        }
        if (!any) {
          const selRect = range.getBoundingClientRect();
          if (!selRect.width || !selRect.height) return null;
          left = selRect.left;
          top = selRect.top;
          right = selRect.right;
          bottom = selRect.bottom;
        }

        const x = (left - pageRect.left) / pageW;
        const y = (top - pageRect.top) / pageH;
        const w = (right - left) / pageW;
        const h = (bottom - top) / pageH;
        return {
          x: Math.max(0, Math.min(1, x)),
          y: Math.max(0, Math.min(1, y)),
          w: Math.max(0.01, Math.min(1, w)),
          h: Math.max(0.008, Math.min(1, h)),
        };
      } catch {
        return null;
      }
    }

    let selectionTimer = null;
    document.addEventListener('selectionchange', () => {
      if (selectionTimer) clearTimeout(selectionTimer);
      selectionTimer = setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || !selection.anchorNode) {
          return;
        }
        // Snap to whole words so highlights/annotations never cut mid-word.
        try {
          const original = selection.getRangeAt(0);
          const expanded = expandRangeToWordBoundaries(original);
          const before = original.toString();
          const after = expanded.toString();
          if (before !== after) {
            selection.removeAllRanges();
            selection.addRange(expanded);
          }
        } catch {
          // keep original selection
        }

        const phrase = selection.toString().trim();
        if (!phrase || phrase.split(/\\s+/).filter(Boolean).length < 2) {
          return;
        }
        const page = selection.anchorNode.parentElement?.closest('.page');
        const pageNumber = page ? Array.from(viewer.children).indexOf(page) + 1 : 0;
        if (pageNumber > 0) {
          const context = selectionContext(selection, phrase);
          const rectNorm = selectionRectNorm(selection, page);
          post({
            type: 'phraseSelect',
            phrase,
            pageNumber,
            context: context || undefined,
            rectNorm: rectNorm || undefined,
          });
        }
      }, 80);
    });

    function marginNoteWidth(pageW, extended) {
      return Math.min(extended ? 168 : 128, pageW * (extended ? 0.4 : 0.32));
    }

    function placeMarginNote(note, pageW, pageH, r, side, extended) {
      const noteW = marginNoteWidth(pageW, extended);
      const topPx = Math.max(4, (r.y || 0) * pageH);
      note.style.top = topPx + 'px';
      note.style.width = noteW + 'px';
      if (side === 'left') {
        note.style.left = (-noteW - 12) + 'px';
        note.style.right = 'auto';
      } else {
        note.style.left = 'auto';
        note.style.right = (-noteW - 12) + 'px';
      }
    }

    function appendMarginNote(overlay, opts) {
      const note = document.createElement('div');
      const extended = Boolean(opts.extended);
      note.className =
        'pinnedNote' +
        (opts.selected ? ' selected' : '') +
        (extended ? ' extended' : '');
      if (opts.pinId) note.dataset.pinId = opts.pinId;
      placeMarginNote(
        note,
        opts.pageW,
        opts.pageH,
        opts.rectNorm || {},
        opts.side === 'left' ? 'left' : 'right',
        extended,
      );
      const phraseEl = document.createElement('p');
      phraseEl.className = 'pinPhrase';
      phraseEl.textContent = String(opts.phrase || '');
      const bodyEl = document.createElement('p');
      bodyEl.className = 'pinBody';
      bodyEl.textContent = String(opts.body || '');
      note.appendChild(phraseEl);
      note.appendChild(bodyEl);
      if (opts.onMouseDown) {
        note.addEventListener('mousedown', opts.onMouseDown);
      }
      overlay.appendChild(note);
      return note;
    }

    function paintPinnedAnnotations() {
      pageEls.forEach((pageEl) => {
        let overlay = pageEl.querySelector('.pinOverlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'pinOverlay';
          pageEl.appendChild(overlay);
        }
        overlay.innerHTML = '';
        const pageNum = Number(pageEl.dataset.pageNumber);
        const pageW = pageEl.clientWidth || pageEl.offsetWidth;
        const pageH = pageEl.clientHeight || pageEl.offsetHeight;
        if (!pageW || !pageH) return;

        pinnedAnnotations
          .filter((p) => Number(p.pageNumber) === pageNum)
          .forEach((pin) => {
            const r = pin.rectNorm || {};
            const selected = pin.id === selectedPinnedId;
            const hi = document.createElement('div');
            hi.className = 'pinnedHighlight' + (selected ? ' selected' : '');
            hi.dataset.pinId = pin.id;
            hi.style.left = (r.x || 0) * pageW + 'px';
            hi.style.top = (r.y || 0) * pageH + 'px';
            hi.style.width = Math.max(8, (r.w || 0) * pageW) + 'px';
            hi.style.height = Math.max(8, (r.h || 0) * pageH) + 'px';
            hi.addEventListener('mousedown', (e) => {
              e.stopPropagation();
              e.preventDefault();
              selectedPinnedId = pin.id;
              schedulePaintPinnedAnnotations();
              post({
                type: 'pinnedAnnotationClick',
                id: pin.id,
                source: 'highlight',
              });
            });
            overlay.appendChild(hi);

            appendMarginNote(overlay, {
              pinId: pin.id,
              phrase: pin.phrase,
              body:
                selected &&
                activeAnnotation &&
                activeAnnotation.pinId === pin.id &&
                activeAnnotation.status === 'ready' &&
                activeAnnotation.content
                  ? activeAnnotation.content
                  : selected &&
                      activeAnnotation &&
                      activeAnnotation.pinId === pin.id &&
                      activeAnnotation.status === 'loading'
                    ? 'Working…'
                    : pin.content,
              rectNorm: r,
              side: pin.side,
              selected,
              extended: selected,
              pageW,
              pageH,
              onMouseDown: (e) => {
                e.stopPropagation();
                e.preventDefault();
                post({
                  type: 'pinnedAnnotationClick',
                  id: pin.id,
                  source: 'note',
                });
              },
            });
          });

        // Live extended annotation beside the selection (before pin / no pin card).
        const active = activeAnnotation;
        if (
          active &&
          Number(active.pageNumber) === pageNum &&
          active.rectNorm &&
          !(
            selectedPinnedId &&
            pinnedAnnotations.some((p) => p.id === selectedPinnedId)
          )
        ) {
          let body = '';
          if (active.status === 'loading') {
            body = 'Working…';
          } else if (active.status === 'error') {
            body = String(active.error || 'Could not annotate.');
          } else {
            body = String(active.content || '');
          }
          appendMarginNote(overlay, {
            phrase: active.phrase,
            body,
            rectNorm: active.rectNorm,
            side: active.side,
            selected: true,
            extended: true,
            pageW,
            pageH,
          });
        }
      });
    }

    function schedulePaintPinnedAnnotations() {
      requestAnimationFrame(() => {
        paintPinnedAnnotations();
      });
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
        // Page CSS size === canvas bitmap CSS size (no stretch). rectNorm is
        // relative to that box (pdf.js viewport / AcroForm / vision capture).
        const pageW =
          Number(pageEl.dataset.pageWidth) ||
          pageEl.clientWidth ||
          pageEl.offsetWidth;
        const pageH =
          Number(pageEl.dataset.pageHeight) ||
          pageEl.clientHeight ||
          pageEl.offsetHeight;
        if (!pageW || !pageH) return;

        formFields
          .filter((f) => f.pageNumber === pageNum)
          .forEach((field) => {
            const el = document.createElement('div');
            el.className =
              'formField' + (field.id === selectedFieldId ? ' selected' : '');
            el.dataset.fieldId = field.id;
            const r = field.rectNorm || {};
            const boxH = Math.max(10, (r.h || 0.02) * pageH);
            el.style.left = (r.x || 0) * pageW + 'px';
            el.style.top = (r.y || 0) * pageH + 'px';
            el.style.width = Math.max(12, (r.w || 0) * pageW) + 'px';
            el.style.height = boxH + 'px';
            const fontPx = Math.max(9, Math.min(16, boxH * 0.72));
            el.style.fontSize = fontPx + 'px';

            el.addEventListener('mousedown', (e) => {
              e.stopPropagation();
              selectedFieldId = field.id;
              schedulePaintFormOverlays();
              post({ type: 'formFieldClick', id: field.id });
            });

            // Magic rectangles: text / date / signature write inputs.
            const value = fieldValues[field.id] ?? '';
            const input = document.createElement('input');
            input.type = 'text';
            input.value = value;
            if (field.type === 'date') {
              input.placeholder = 'mm/dd/yyyy';
            } else if (field.type === 'signature') {
              input.placeholder = 'Signature';
            } else {
              input.placeholder = '';
            }
            input.autocomplete = 'off';
            input.spellcheck = false;
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

            overlay.appendChild(el);
          });
      });
    }

    function schedulePaintFormOverlays() {
      requestAnimationFrame(() => {
        paintFormOverlays();
      });
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

    /** LiveCycle / AcroForm fieldName → readable label. */
    function humanizeWidgetName(raw) {
      const full = String(raw || '');
      const leaf = full.split('.').pop() || full;
      return leaf
        .replace(/\\[\\d+\\]/g, '')
        .replace(/_/g, ' ')
        .replace(/\\s+/g, ' ')
        .trim()
        .slice(0, 100);
    }

    function looksLikeDateField(name) {
      const n = String(name || '').toLowerCase();
      if (!n) return false;
      if (/signature/.test(n)) return false;
      return (
        /\\bdate\\b/.test(n) ||
        /mm\\s*dd\\s*yyyy/.test(n) ||
        /mmddyyyy/.test(n) ||
        /expiration/.test(n) ||
        /\\bbirth\\b/.test(n) ||
        /rehire/.test(n) ||
        /first\\s*day\\s*of\\s*employment/.test(n) ||
        /dob\\b/.test(n)
      );
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

    function rectIoULocal(a, b) {
      const ax2 = a.x + a.w;
      const ay2 = a.y + a.h;
      const bx2 = b.x + b.w;
      const by2 = b.y + b.h;
      const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
      const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
      const inter = ix * iy;
      if (inter <= 0) return 0;
      const union = a.w * a.h + b.w * b.h - inter;
      return union > 0 ? inter / union : 0;
    }

    function overlapsExisting(candidate, existing) {
      // Strict IoU only — wet-ink lines sit near (not on) name widgets below.
      return existing.some(
        (f) =>
          f.pageNumber === candidate.pageNumber &&
          rectIoULocal(f.rectNorm, candidate.rectNorm) >= 0.22,
      );
    }

    /**
     * Real AcroForm text widgets via pdf.js (works on encrypted LiveCycle
     * PDFs like Form I-9 where pdf-lib fails).
     */
    async function detectAcroformTextFields() {
      const fields = [];
      if (!pdfDoc) return fields;
      for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const pageW = viewport.width || 1;
        const pageH = viewport.height || 1;
        const annotations = await page.getAnnotations({ intent: 'display' });
        for (let i = 0; i < annotations.length; i++) {
          const ann = annotations[i];
          if (!ann || ann.subtype !== 'Widget') continue;
          if (ann.fieldType !== 'Tx') continue;
          const rect = ann.rect;
          if (!Array.isArray(rect) || rect.length < 4) continue;
          const x1 = Number(rect[0]);
          const y1 = Number(rect[1]);
          const x2 = Number(rect[2]);
          const y2 = Number(rect[3]);
          if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
          const left = Math.min(x1, x2);
          const right = Math.max(x1, x2);
          const bottom = Math.min(y1, y2);
          const top = Math.max(y1, y2);
          const w = (right - left) / pageW;
          const h = (top - bottom) / pageH;
          if (w < 0.008 || h < 0.006) continue;
          const rawName = String(ann.fieldName || '');
          const name = humanizeWidgetName(rawName) || 'Text field';
          const id =
            (rawName || 'tx_' + pageNumber + '_' + i)
              .replace(/[^a-zA-Z0-9._\\-]+/g, '_')
              .slice(0, 160) || 'tx_' + pageNumber + '_' + i;
          fields.push({
            id,
            name,
            type: looksLikeDateField(name) || looksLikeDateField(rawName)
              ? 'date'
              : 'text',
            pageNumber,
            rectNorm: {
              x: Math.max(0, Math.min(1, left / pageW)),
              y: Math.max(0, Math.min(1, (pageH - top) / pageH)),
              w: Math.max(0.008, Math.min(1, w)),
              // Keep true widget height (incl. multiline) — no line clamp.
              h: Math.max(0.006, Math.min(1, h)),
            },
            source: 'acroform',
          });
        }
      }
      const wetInk = await detectWetInkSignatureDateFields(fields);
      return fields.concat(wetInk);
    }

    /**
     * I-9-style wet-ink blanks: signature / Today's Date lines sit ABOVE the
     * printed caption and have no AcroForm widgets.
     */
    async function detectWetInkSignatureDateFields(existing) {
      const extras = [];
      if (!pdfDoc) return extras;
      let idx = 0;
      for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();
        const items = (textContent.items || []).filter(
          (it) => it && typeof it.str === 'string' && it.str.trim(),
        );
        const labels = [];
        for (let i = 0; i < items.length; i++) {
          const str = String(items[i].str).trim();
          const bounds = itemBounds(items[i], viewport);
          if (/^Signature of\\b/i.test(str)) {
            labels.push({ kind: 'signature', str, bounds });
          } else if (/^Today'?s Date$/i.test(str)) {
            labels.push({ kind: 'date', str, bounds });
          }
        }

        for (let i = 0; i < labels.length; i++) {
          const label = labels[i];
          const b = label.bounds;
          const lineH = Math.max(0.016, Math.min(0.022, b.h * 1.2 || 0.02));
          // Sit on the underline: nudge down onto the write band above the caption.
          const y = Math.max(0.01, b.y - lineH + 0.02);
          let x = Math.max(0.04, b.x);
          let w;

          if (label.kind === 'signature') {
            // Clip before a same-row Today's Date caption when present.
            let right = 0.58;
            for (let j = 0; j < labels.length; j++) {
              const other = labels[j];
              if (other.kind !== 'date') continue;
              const midY = b.y + b.h / 2;
              const otherMid = other.bounds.y + other.bounds.h / 2;
              if (Math.abs(midY - otherMid) > 0.025) continue;
              if (other.bounds.x > b.x + 0.08) {
                right = Math.min(right, other.bounds.x - 0.02);
              }
            }
            w = Math.max(0.12, right - x);
          } else {
            w = Math.max(0.1, Math.min(0.92, 0.94) - x);
          }

          const candidate = {
            id: 'wet_' + label.kind + '_' + pageNumber + '_' + idx,
            name: cleanLabel(label.str) || (label.kind === 'signature' ? 'Signature' : "Today's Date"),
            type: label.kind === 'signature' ? 'signature' : 'date',
            pageNumber,
            rectNorm: {
              x,
              y,
              w: Math.min(0.9, w),
              h: lineH,
            },
            source: 'heuristic',
          };
          idx += 1;
          if (overlapsExisting(candidate, existing.concat(extras))) continue;
          extras.push(candidate);
        }
      }
      return extras;
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
        // Line-sized writing area — keep blanks short vertically.
        h: Math.max(0.012, Math.min(0.035, h)),
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
      const lineH = Math.max(0.012, Math.min(0.032, bounds.h));
      return {
        x: bounds.x + bounds.w * startFrac,
        y: bounds.y + Math.max(0, (bounds.h - lineH) * 0.15),
        w: Math.max(0.04, bounds.w * blankFrac),
        h: lineH,
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
      const lineH = Math.max(0.012, Math.min(0.032, labelBounds.h));
      return {
        x: gapStart,
        y: labelBounds.y + Math.max(0, (labelBounds.h - lineH) * 0.15),
        w,
        h: lineH,
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
      const minW = 0.035;
      if (rect.w < minW || rect.h < 0.008) return false;
      const candidate = {
        id: 'heur_' + pageNumber + '_' + idxRef.n,
        name: label,
        type: 'text',
        pageNumber,
        rectNorm: {
          x: Math.max(0, Math.min(0.98, rect.x)),
          y: Math.max(0, Math.min(0.98, rect.y)),
          w: Math.max(minW, Math.min(0.95, rect.w)),
          // Cap height to a single writing line.
          h: Math.max(0.012, Math.min(0.035, rect.h)),
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
            // Text-only detection — skip checkbox glyphs.
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
      pageEl.dataset.pageWidth = String(viewport.width);
      pageEl.dataset.pageHeight = String(viewport.height);
      pageEl.style.width = viewport.width + 'px';
      pageEl.style.height = viewport.height + 'px';

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';
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
      if (pinnedAnnotations.length) {
        schedulePaintPinnedAnnotations();
      }

      post({ type: 'pageReady', pageNumber: pageNum });
    }

    function targetPageWidth() {
      // #viewer uses large horizontal padding — page width must fit the
      // content box, not the full document width, or max-width squashing
      // (historically) / overflow misalignment breaks overlay mapping.
      const padL = parseFloat(getComputedStyle(viewer).paddingLeft) || 0;
      const padR = parseFloat(getComputedStyle(viewer).paddingRight) || 0;
      const available = Math.max(
        120,
        (viewer.clientWidth || document.documentElement.clientWidth) - padL - padR,
      );
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

    window.__kvSetPinnedAnnotations = function (pins) {
      pinnedAnnotations = Array.isArray(pins) ? pins : [];
      schedulePaintPinnedAnnotations();
    };

    window.__kvSetSelectedPinnedId = function (id) {
      selectedPinnedId = id || null;
      schedulePaintPinnedAnnotations();
    };

    window.__kvSetActiveAnnotation = function (active) {
      activeAnnotation =
        active && typeof active === 'object' && active.rectNorm
          ? active
          : null;
      schedulePaintPinnedAnnotations();
    };

    window.__kvSetColorScheme = function (scheme) {
      document.documentElement.dataset.scheme =
        scheme === 'dark' ? 'dark' : 'light';
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

    window.__kvSetFieldValues = function (values) {
      if (!values || typeof values !== 'object') return;
      Object.keys(values).forEach(function (id) {
        fieldValues[id] = values[id] == null ? '' : String(values[id]);
      });
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

    window.__kvRunAcroformDetect = async function () {
      try {
        const fields = await detectAcroformTextFields();
        post({ type: 'acroformFields', fields });
      } catch (err) {
        post({
          type: 'acroformFields',
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
          // Capture from the bitmap (same aspect as viewport / rectNorm space).
          const srcW = canvas.width;
          const srcH = canvas.height;
          if (!srcW || !srcH) continue;
          const maxW = 960;
          const scale = Math.min(1, maxW / srcW);
          const outW = Math.max(1, Math.round(srcW * scale));
          const outH = Math.max(1, Math.round(srcH * scale));
          let out = canvas;
          if (outW !== srcW || outH !== srcH) {
            const tmp = document.createElement('canvas');
            tmp.width = outW;
            tmp.height = outH;
            tmp.getContext('2d').drawImage(canvas, 0, 0, outW, outH);
            out = tmp;
          }
          const dataUrl = out.toDataURL('image/jpeg', 0.65);
          const comma = dataUrl.indexOf(',');
          pages.push({
            pageNumber: n,
            imageBase64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
            mimeType: 'image/jpeg',
            width: outW,
            height: outH,
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

    window.__kvExportFilledPages = async function () {
      try {
        const pages = [];
        const sortedNums = Array.from(pageEls.keys()).sort(function (a, b) {
          return a - b;
        });
        for (let i = 0; i < sortedNums.length; i++) {
          const n = sortedNums[i];
          const pageEl = pageEls.get(n);
          if (!pageEl) continue;
          const canvas = pageEl.querySelector('canvas');
          if (!canvas) continue;
          const srcW = canvas.width;
          const srcH = canvas.height;
          if (!srcW || !srcH) continue;

          const tmp = document.createElement('canvas');
          tmp.width = srcW;
          tmp.height = srcH;
          const ctx = tmp.getContext('2d');
          ctx.drawImage(canvas, 0, 0);

          formFields
            .filter(function (f) {
              return f.pageNumber === n;
            })
            .forEach(function (field) {
              const raw = fieldValues[field.id];
              const text = raw == null ? '' : String(raw).trim();
              if (!text) return;
              const r = field.rectNorm || {};
              const boxX = (r.x || 0) * srcW;
              const boxY = (r.y || 0) * srcH;
              const boxW = Math.max(8, (r.w || 0) * srcW);
              const boxH = Math.max(8, (r.h || 0) * srcH);
              const fontPx = Math.max(9, Math.min(22, boxH * 0.7));
              ctx.save();
              ctx.beginPath();
              ctx.rect(boxX, boxY, boxW, boxH);
              ctx.clip();
              ctx.fillStyle = '#1d1d1f';
              ctx.textBaseline = 'middle';
              ctx.textAlign = 'left';
              ctx.font =
                fontPx +
                'px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
              const padX = Math.max(2, boxH * 0.12);
              ctx.fillText(text, boxX + padX, boxY + boxH / 2, boxW - padX * 2);
              ctx.restore();
            });

          const dataUrl = tmp.toDataURL('image/jpeg', 0.92);
          const comma = dataUrl.indexOf(',');
          pages.push({
            pageNumber: n,
            imageBase64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
            mimeType: 'image/jpeg',
            width: srcW,
            height: srcH,
          });
        }
        post({ type: 'filledPageImages', pages });
      } catch (err) {
        post({
          type: 'filledPageImages',
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
