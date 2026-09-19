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
};

type DetectedField = {
  id: string;
  name: string;
  type: FieldType;
  pageNumber: number;
  rectNorm: RectNorm;
};

const MAX_PAGES = 1;
const ALLOWED_TYPES = new Set<FieldType>([
  'text',
  'checkbox',
  'radio',
  'dropdown',
  'signature',
  'unknown',
]);

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
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
    return jsonResponse({fields: []});
  }

  const content: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: `You analyze PDF page images of forms. Find EVERY blank fillable region: text lines, checkboxes, signature areas, dropdowns.
Return ONLY valid JSON (no markdown) matching:
{"fields":[{"id":"string","name":"string","type":"text|checkbox|radio|dropdown|signature|unknown","pageNumber":1,"rectNorm":{"x":0,"y":0,"w":0,"h":0}}]}
Rules:
- rectNorm is normalized 0–1 with origin at the TOP-LEFT of that page image.
- pageNumber must match the page number given for each image.
- Report all empty blanks on the page (underscores, boxes, signature lines); do not stop after a few.
- Prefer empty blanks, not filled text.
- name should be a short semantic label (e.g. "Full Name", "Date", "Signature").
- Skip decorative lines and table grid lines that are not fillable.
- If no blanks, return {"fields":[]}.`,
    },
  ];

  for (const page of pages) {
    const pageNumber = Math.max(1, Math.floor(Number(page.pageNumber) || 1));
    const mime = page.mimeType || 'image/jpeg';
    const raw = stripDataUrl(String(page.imageBase64 || ''));
    if (!raw) continue;
    content.push({
      type: 'text',
      text: `Page ${pageNumber}:`,
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
      oaJson?.choices?.[0]?.message?.content ?? '{"fields":[]}';

    let parsed: {fields?: unknown};
    try {
      parsed = JSON.parse(text);
    } catch {
      return jsonResponse({error: 'Model returned invalid JSON'}, 502);
    }

    const rawFields = Array.isArray(parsed.fields) ? parsed.fields : [];
    const fields: DetectedField[] = [];

    rawFields.forEach((raw: Record<string, unknown>, index: number) => {
      const rect = raw.rectNorm as Record<string, unknown> | undefined;
      if (!rect) return;
      const x = clamp01(Number(rect.x));
      const y = clamp01(Number(rect.y));
      const w = clamp01(Number(rect.w));
      const h = clamp01(Number(rect.h));
      if (w <= 0.005 || h <= 0.005) return;

      const typeRaw = String(raw.type || 'unknown') as FieldType;
      const type = ALLOWED_TYPES.has(typeRaw) ? typeRaw : 'unknown';
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

    return jsonResponse({fields});
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({error: message}, 500);
  }
});
