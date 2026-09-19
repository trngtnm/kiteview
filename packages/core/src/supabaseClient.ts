import 'react-native-url-polyfill/auto';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import type {DetectedFormField, FormFieldType, RectNorm} from '@kiteview/pdf-engine';
import {getEnv} from './env';

export type FormPageImage = {
  pageNumber: number;
  imageBase64: string;
  mimeType: 'image/jpeg';
};

export type FormsDetectRequest = {
  pages: FormPageImage[];
};

export type FormsDetectResponse = {
  fields: Array<{
    id: string;
    name: string;
    type: FormFieldType;
    pageNumber: number;
    rectNorm: RectNorm;
  }>;
  error?: string;
};

let client: SupabaseClient | null = null;

/** True when Supabase URL + anon key are present (vision detect can be invoked). */
export function isSupabaseConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!client) {
    const env = getEnv();
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return client;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function normalizeField(
  raw: FormsDetectResponse['fields'][number],
  index: number,
): DetectedFormField | null {
  const rect = raw.rectNorm;
  if (!rect) return null;
  const x = clamp01(Number(rect.x));
  const y = clamp01(Number(rect.y));
  const w = clamp01(Number(rect.w));
  const h = clamp01(Number(rect.h));
  if (w <= 0.005 || h <= 0.005) return null;

  const allowed: FormFieldType[] = [
    'text',
    'checkbox',
    'radio',
    'dropdown',
    'signature',
    'unknown',
  ];
  const type = allowed.includes(raw.type) ? raw.type : 'unknown';

  return {
    id: raw.id || `vision_${index}`,
    name: (raw.name || `Field ${index + 1}`).slice(0, 120),
    type,
    pageNumber: Math.max(1, Math.floor(Number(raw.pageNumber) || 1)),
    rectNorm: {x, y, w, h},
    source: 'vision',
  };
}

/**
 * Call Supabase Edge Function `forms-detect` (OpenAI vision server-side).
 * Returns normalized DetectedFormField[] or throws on transport/API errors.
 */
export async function invokeFormsDetect(
  pages: FormPageImage[],
): Promise<DetectedFormField[]> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }
  if (!pages.length) {
    return [];
  }

  const {data, error} = await supabase.functions.invoke('forms-detect', {
    body: {pages} satisfies FormsDetectRequest,
  });

  if (error) {
    let detail = error.message || 'forms-detect failed';
    try {
      const ctx = (error as {context?: Response}).context;
      if (ctx && typeof ctx.json === 'function') {
        const body = (await ctx.json()) as {error?: string; message?: string};
        if (body?.error) {
          detail = body.error;
        } else if (body?.message) {
          detail = body.message;
        }
      }
    } catch {
      // keep generic message
    }
    throw new Error(detail);
  }

  const payload = data as FormsDetectResponse | null;
  if (!payload) {
    return [];
  }
  if (payload.error) {
    throw new Error(payload.error);
  }

  const fields = Array.isArray(payload.fields) ? payload.fields : [];
  return fields
    .map((f, i) => normalizeField(f, i))
    .filter((f): f is DetectedFormField => f != null);
}
