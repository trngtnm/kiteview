export type EnvConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  gptEndpointUrl: string;
};

type RawEnv = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  GPT_ENDPOINT_URL?: string;
};

let injectedEnv: RawEnv = {};

/**
 * Inject env values from the native shell (react-native-config) or tests.
 * Call once at app startup before reading getters.
 */
export function setEnv(raw: RawEnv): void {
  injectedEnv = {...raw};
}

/**
 * Resolve the annotate Edge Function URL.
 * Metro/babel often keeps a stale GPT_ENDPOINT_URL (e.g. forms-detect) after
 * .env edits — prefer SUPABASE_URL and rewrite any …/functions/v1/<name> to annotate.
 */
export function resolveAnnotateEndpointUrl(
  gptEndpointUrl?: string,
  supabaseUrl?: string,
): string {
  const endpoint = (gptEndpointUrl ?? injectedEnv.GPT_ENDPOINT_URL ?? '')
    .trim()
    .replace(/\/+$/, '');
  const base = (supabaseUrl ?? injectedEnv.SUPABASE_URL ?? '')
    .trim()
    .replace(/\/+$/, '');

  if (/\/functions\/v1\/annotate$/i.test(endpoint)) {
    return endpoint;
  }
  if (/\/functions\/v1\/[^/]+$/i.test(endpoint)) {
    return endpoint.replace(/\/functions\/v1\/[^/]+$/i, '/functions/v1/annotate');
  }
  if (base) {
    return `${base}/functions/v1/annotate`;
  }
  return endpoint;
}

export function getEnv(): EnvConfig {
  const supabaseUrl = injectedEnv.SUPABASE_URL ?? '';
  const supabaseAnonKey = injectedEnv.SUPABASE_ANON_KEY ?? '';
  const rawGpt = injectedEnv.GPT_ENDPOINT_URL ?? '';
  return {
    supabaseUrl,
    supabaseAnonKey,
    gptEndpointUrl: resolveAnnotateEndpointUrl(rawGpt, supabaseUrl),
  };
}

export function isEnvConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.supabaseUrl && env.supabaseAnonKey && env.gptEndpointUrl);
}

/** Supabase URL + anon key only (enough for Edge function invokes). */
export function isSupabaseEnvConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
