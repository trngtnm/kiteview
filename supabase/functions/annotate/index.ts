/**
 * Supabase Edge Function: annotate
 *
 * Explains or summarizes a selected PDF phrase via OpenAI gpt-4o-mini.
 * Signed-in users: loads reading_preferences via RLS and personalizes the prompt.
 * Guests (anon JWT): uses default intermediate / conversational prefs.
 *
 * Secrets (never in client):
 *   supabase secrets set OPENAI_API_KEY=sk-...
 *
 * Deploy:
 *   supabase functions deploy annotate
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {corsHeaders} from '../_shared/cors.ts';

type AnnotateBody = {
  selection_text?: string;
  text?: string;
  page_number?: number;
  annotation_type?: string;
  instruction?: string;
  prompt?: string;
  context?: string;
  custom_instructions?: string;
  messages?: {role?: string; content?: string}[];
};

type AnnotationMode = 'explain' | 'summarize';

type ReadingPrefs = {
  reading_level: string;
  native_language: string;
  explanation_language: string;
  domain_tags: string[];
  tone: string;
  custom_instructions: string;
};

const DEFAULT_PREFS: ReadingPrefs = {
  reading_level: 'intermediate',
  native_language: 'en',
  explanation_language: 'en',
  domain_tags: [],
  tone: 'conversational',
  custom_instructions: '',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...corsHeaders, 'Content-Type': 'application/json'},
  });
}

function normalizeMode(raw: string | undefined): AnnotationMode {
  const t = String(raw || 'explain').trim().toLowerCase();
  if (t === 'summarize' || t === 'summary') return 'summarize';
  return 'explain';
}

function clampInstructions(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, 1000);
}

function systemPromptFor(mode: AnnotationMode, prefs: ReadingPrefs): string {
  const domains =
    prefs.domain_tags.length > 0
      ? prefs.domain_tags.join(', ')
      : 'general';
  const maxSentences =
    prefs.reading_level === 'academic' ? '2–5' : '1–3';
  const task =
    mode === 'summarize'
      ? 'summarize the selected passage'
      : 'explain the selected phrase in clear terms and briefly what it means in context';

  const parts = [
    'You are KiteView, a reading companion that helps people understand PDF text.',
    `Task: ${task}.`,
    `Tailor the response for reading_level=${prefs.reading_level}, tone=${prefs.tone},`,
    `domain_familiarity=${domains}, target_language=${prefs.explanation_language}`,
    `(reader native_language=${prefs.native_language}).`,
    `Respond in ${prefs.explanation_language} with plain prose only — no markdown headings, no bullet lists, no JSON.`,
    `Keep the answer to ${maxSentences} short sentences.`,
  ];
  if (prefs.custom_instructions) {
    parts.push(
      `Additional reader preferences (follow when reasonable): ${prefs.custom_instructions}`,
    );
  }
  return parts.join(' ');
}

async function loadPreferences(
  req: Request,
  bodyInstructions: string,
): Promise<ReadingPrefs> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return {
      ...DEFAULT_PREFS,
      custom_instructions: bodyInstructions,
    };
  }

  const authHeader = req.headers.get('Authorization') || '';
  const supabase = createClient(supabaseUrl, anonKey, {
    global: {headers: {Authorization: authHeader}},
    auth: {persistSession: false, autoRefreshToken: false},
  });

  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ...DEFAULT_PREFS,
      custom_instructions: bodyInstructions,
    };
  }

  const {data, error} = await supabase
    .from('reading_preferences')
    .select(
      'reading_level, native_language, explanation_language, domain_tags, tone, custom_instructions',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    return {
      ...DEFAULT_PREFS,
      custom_instructions: bodyInstructions,
    };
  }

  return {
    reading_level: data.reading_level || DEFAULT_PREFS.reading_level,
    native_language: data.native_language || DEFAULT_PREFS.native_language,
    explanation_language:
      data.explanation_language || DEFAULT_PREFS.explanation_language,
    domain_tags: Array.isArray(data.domain_tags) ? data.domain_tags : [],
    tone: data.tone || DEFAULT_PREFS.tone,
    custom_instructions:
      clampInstructions(data.custom_instructions) || bodyInstructions,
  };
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
  const bodyInstructions = clampInstructions(body.custom_instructions);
  const prefs = await loadPreferences(req, bodyInstructions);
  const systemPrompt = systemPromptFor(mode, prefs);

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
