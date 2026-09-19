/**
 * Supabase Edge Function: annotate
 *
 * Explains or summarizes a selected PDF phrase via OpenAI gpt-4o-mini.
 * Matches the client contract in packages/core/src/annotation.ts.
 *
 * Secrets (never in client):
 *   supabase secrets set OPENAI_API_KEY=sk-...
 *
 * Deploy:
 *   supabase functions deploy annotate
 */

import {corsHeaders} from '../_shared/cors.ts';

type AnnotateBody = {
  selection_text?: string;
  text?: string;
  page_number?: number;
  annotation_type?: string;
  instruction?: string;
  prompt?: string;
  context?: string;
  messages?: {role?: string; content?: string}[];
};

type AnnotationMode = 'explain' | 'summarize';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...corsHeaders, 'Content-Type': 'application/json'},
  });
}

function normalizeMode(raw: string | undefined): AnnotationMode {
  const t = String(raw || 'explain').trim().toLowerCase();
  if (t === 'summarize' || t === 'summary') return 'summarize';
  // legacy "paraphrase" maps to explain
  return 'explain';
}

function systemPromptFor(mode: AnnotationMode): string {
  if (mode === 'summarize') {
    return [
      'You are KiteView, a reading companion that helps people understand PDF text.',
      'Task: summarize the selected passage.',
      'Write a concise summary of what the selection says.',
      'Respond with plain prose only — no markdown headings, no bullet lists, no JSON.',
      'Keep the answer to 1–3 short sentences.',
    ].join(' ');
  }
  return [
    'You are KiteView, a reading companion that helps people understand PDF text.',
    'Task: explain the selected phrase.',
    'Explain the selected text in clear layman terms and briefly describe what it means in context.',
    'Respond with plain prose only — no markdown headings, no bullet lists, no JSON.',
    'Keep the answer to 1–3 short sentences.',
  ].join(' ');
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

  let body: AnnotateBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({error: 'Invalid JSON body'}, 400);
  }

  const selection = String(body.selection_text || body.text || '').trim();
  if (!selection) {
    return jsonResponse({error: 'selection_text is required'}, 400);
  }

  const mode = normalizeMode(body.annotation_type);
  const context = String(body.context || '').trim();
  const systemPrompt = systemPromptFor(mode);

  const userPrompt = context
    ? `Selected text: "${selection}"\n\nSurrounding context:\n${context}`
    : `Selected text: "${selection}"`;

  try {
    const oaRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 300,
        messages: [
          {role: 'system', content: systemPrompt},
          {role: 'user', content: userPrompt},
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
    const message = oaJson?.choices?.[0]?.message ?? {};
    // Some models put text in `content`; refusal/tool paths may leave it empty.
    const content = String(
      message.content ?? message.refusal ?? oaJson?.choices?.[0]?.text ?? '',
    ).trim();

    if (!content) {
      return jsonResponse(
        {
          error: 'Model returned an empty annotation',
          debug: {
            finish_reason: oaJson?.choices?.[0]?.finish_reason ?? null,
            has_choices: Array.isArray(oaJson?.choices),
          },
        },
        502,
      );
    }

    return jsonResponse({
      content,
      explanation: content,
      paraphrase: content,
      annotation_type: mode,
      page_number: body.page_number ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({error: message}, 500);
  }
});
