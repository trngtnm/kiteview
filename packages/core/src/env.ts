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

export function getEnv(): EnvConfig {
  return {
    supabaseUrl: injectedEnv.SUPABASE_URL ?? '',
    supabaseAnonKey: injectedEnv.SUPABASE_ANON_KEY ?? '',
    gptEndpointUrl: injectedEnv.GPT_ENDPOINT_URL ?? '',
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
