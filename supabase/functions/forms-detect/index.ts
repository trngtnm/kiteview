/**
 * Supabase Edge Function: forms-detect
 *
 * Accepts page JPEG images, calls OpenAI gpt-4o-mini vision, returns blank form
 * field boxes as normalized 0–1 top-left rectangles.
 *
 * Secrets (never in client):
 *   supabase secrets set OPENAI_API_KEY=sk-...
 *
 * Deploy:
 *   supabase functions deploy forms-detect
 */

import {corsHeaders} from '../_shared/cors.ts';

type FieldType =
  | 'text'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'signature'
  | 'unknown';

type RectNorm = {x: number; y: number; w: number; h: number};

type PageInput = {
  pageNumber: number;
  imageBase64: string;
  mimeType?: string;
  width?: number;
  height?: number;
};

type DetectedField = {
  id: string;
  name: string;
  type: FieldType;
  pageNumber: number;
  rectNorm: RectNorm;
};

const MAX_PAGES = 1;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Accept 0–1 fractions or 0–100 percentages from the model. */
function normUnit(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n > 1) return clamp01(n / 100);
  return clamp01(n);
}

function stripDataUrl(b64: string): string {
  const i = b64.indexOf(',');
  return i >= 0 ? b64.slice(i + 1) : b64;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...corsHeaders, 'Content-Type': 'application/json'},
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: corsHeaders});
  }

  if (req.method !== 'POST') {
    return jsonResponse({error: 'Method not allowed'}, 405);
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    return jsonResponse(
      {error: 'OPENAI_API_KEY is not configured on the server'},
      500,
    );
  }

  let body: {pages?: PageInput[]};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({error: 'Invalid JSON body'}, 400);
  }

  const pages = Array.isArray(body.pages) ? body.pages.slice(0, MAX_PAGES) : [];
  if (pages.length === 0) {
    return jsonResponse({documentType: 'informative', fields: []});
  }

  const content: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: `You analyze PDF page images. First decide if the page is a FILLABLE FORM or INFORMATIONAL content, then find blank TEXT input regions only when it is a form.

Return ONLY valid JSON (no markdown) matching:
{"documentType":"form"|"informative","fields":[{"id":"string","name":"string","type":"text","pageNumber":1,"rectNorm":{"x":0,"y":0,"w":0,"h":0}}]}

documentType rules:
- "form": page is clearly meant for the reader to FILL IN (application, I-9, W-4, intake, survey, tax, enrollment). Labeled blanks for Name/Date/Address/Signature, empty input boxes, or signature lines.
- "informative": articles, guides, letters, essays, textbooks, slides, reports, manuals, or other explanatory/reading pages. Prefer "informative" when unsure.
- Decorative underlines, horizontal rules, table grids, TOC dots, list bullets, and already-printed text are NOT fillable blanks — classify as informative with fields [].
- If informative, fields MUST be [].

Field rules (only when documentType is "form"):
- Find ONLY blank TEXT input regions (underscores, empty text lines, empty boxes meant for typing). Do NOT report checkboxes, radio buttons, signature pads, or dropdowns.
- Every field MUST have type "text". Never emit checkbox, radio, dropdown, or signature.
- rectNorm uses fractions of the FULL page image width/height (0 to 1). Origin is TOP-LEFT of the image as provided (not a square crop, not PDF bottom-left).
- x,y = top-left of the blank TEXT INPUT; w,h = width/height of that blank only. Example: {"x":0.35,"y":0.22,"w":0.4,"h":0.025}.
- NEVER use pixel coordinates or 0–100 percentages — only 0–1.
- name MUST be the nearest printed label to that blank (e.g. "Full Name", "Email"). Do not invent names; do not use generic "Field 1".
- Draw TIGHT boxes on the writable text blank only (underscores / empty text boxes). Prefer undersized to oversized. Do NOT include the label text inside the box.
- Typical blank height is about 0.015–0.03 of page height (one writing line). Never emit h > 0.04 unless the blank is clearly a multi-line text area.
- Do NOT box section headers, titles, instructions, table grid lines, checkboxes, or already-filled text.
- Ignore letterboxing/padding; coords are relative to the page content image dimensions given per page.
- pageNumber must match the page number given for each image.
- If documentType is "form" but no text blanks, return {"documentType":"form","fields":[]}.`,
    },
  ];

  for (const page of pages) {
    const pageNumber = Math.max(1, Math.floor(Number(page.pageNumber) || 1));
    const mime = page.mimeType || 'image/jpeg';
    const raw = stripDataUrl(String(page.imageBase64 || ''));
    if (!raw) continue;
    const w = Number(page.width) || 0;
    const h = Number(page.height) || 0;
    const sizeHint =
      w > 0 && h > 0
        ? ` (${w}×${h}px). rectNorm is relative to this ${w}×${h} image.`
        : '.';
    content.push({
      type: 'text',
      text: `Page ${pageNumber}${sizeHint}`,
    });
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${mime};base64,${raw}`,
        detail: 'low',
      },
    });
  }

  try {
    const oaRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: {type: 'json_object'},
        messages: [
          {
            role: 'user',
            content,
          },
        ],
      }),
    });

    if (!oaRes.ok) {
      const errText = await oaRes.text();
      return jsonResponse(
        {
          error: `OpenAI error (${oaRes.status}): ${errText.slice(0, 400)}`,
        },
        502,
      );
    }

    const oaJson = await oaRes.json();
    const text: string =
      oaJson?.choices?.[0]?.message?.content ??
      '{"documentType":"informative","fields":[]}';

    let parsed: {fields?: unknown; documentType?: unknown};
    try {
      parsed = JSON.parse(text);
    } catch {
      return jsonResponse({error: 'Model returned invalid JSON'}, 502);
    }

    const documentTypeRaw = String(parsed.documentType || '')
      .trim()
      .toLowerCase();
    const documentType: 'form' | 'informative' =
      documentTypeRaw === 'form' ? 'form' : 'informative';

    if (documentType === 'informative') {
      return jsonResponse({documentType: 'informative', fields: []});
    }

    const rawFields = Array.isArray(parsed.fields) ? parsed.fields : [];
    const fields: DetectedField[] = [];

    rawFields.forEach((raw: Record<string, unknown>, index: number) => {
      const rect = raw.rectNorm as Record<string, unknown> | undefined;
      if (!rect) return;
      let x = normUnit(Number(rect.x));
      let y = normUnit(Number(rect.y));
      let w = normUnit(Number(rect.w));
      let h = normUnit(Number(rect.h));

      // Model sometimes returns bottom-right as w/h (x2,y2).
      const rawX = Number(rect.x);
      const rawY = Number(rect.y);
      const rawW = Number(rect.w);
      const rawH = Number(rect.h);
      if (
        Number.isFinite(rawX) &&
        Number.isFinite(rawY) &&
        Number.isFinite(rawW) &&
        Number.isFinite(rawH) &&
        rawW > rawX &&
        rawH > rawY &&
        rawW <= 1.0001 &&
        rawH <= 1.0001 &&
        rawX >= 0 &&
        rawY >= 0
      ) {
        const asWidth = rawW - rawX;
        const asHeight = rawH - rawY;
        // Prefer x2/y2 decode when "width" would be implausibly large for a blank.
        if (asWidth > 0.005 && asHeight > 0.005 && (w > 0.45 || h > 0.45)) {
          x = clamp01(rawX);
          y = clamp01(rawY);
          w = clamp01(asWidth);
          h = clamp01(asHeight);
        }
      }

      if (w <= 0.005 || h <= 0.005) return;
      if (x + w > 1) w = Math.max(0.005, 1 - x);
      if (y + h > 1) h = Math.max(0.005, 1 - y);

      // Keep write-area boxes line-sized unless clearly a tall multi-line blank.
      if (h > 0.04) {
        h = Math.min(h, 0.04);
      }
      h = Math.max(0.012, Math.min(0.04, h));
      w = Math.max(0.03, w);

      const typeRaw = String(raw.type || 'text') as FieldType;
      // Text-only: drop non-text types; coerce unknown → text.
      if (
        typeRaw === 'checkbox' ||
        typeRaw === 'radio' ||
        typeRaw === 'dropdown' ||
        typeRaw === 'signature'
      ) {
        return;
      }
      const type: FieldType = 'text';
      const pageNumber = Math.max(1, Math.floor(Number(raw.pageNumber) || 1));
      const name = String(raw.name || `Field ${index + 1}`).slice(0, 120);
      const id = String(raw.id || `vision_${pageNumber}_${index}`);

      fields.push({
        id,
        name,
        type,
        pageNumber,
        rectNorm: {x, y, w, h},
      });
    });

    return jsonResponse({documentType: 'form', fields});
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({error: message}, 500);
  }
});
