import {GPT_ENDPOINT_URL, SUPABASE_ANON_KEY, SUPABASE_URL} from '@env';
import {setEnv} from '@kiteview/core';

/**
 * Public client config only — OpenAI secrets stay in Supabase Edge Function secrets.
 * Values come from the root `.env` (see `.env.example`).
 *
 * getEnv() rewrites a stale GPT_ENDPOINT_URL (e.g. cached forms-detect) to annotate.
 */
export function bootstrapEnv(): void {
  setEnv({
    SUPABASE_URL: SUPABASE_URL || '',
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY || '',
    GPT_ENDPOINT_URL: GPT_ENDPOINT_URL || '',
  });
}
