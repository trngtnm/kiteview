import {getEnv} from './env';
import {annotatePhrase} from './filePicker';
import {useAuthStore} from './authStore';
import {usePreferencesStore} from './preferencesStore';

export type AnnotationMode = 'explain' | 'summarize';

export type PhraseAnnotation = {
  phrase: string;
  content: string;
  mode: AnnotationMode;
};

export type FetchAnnotationOptions = {
  pageNumber?: number;
  mode?: AnnotationMode;
  context?: string;
};

type AnnotationResponse = {
  paraphrase?: string;
  explanation?: string;
  content?: string;
  result?: string;
  error?: string;
  message?: string;
  fields?: unknown;
  choices?: {message?: {content?: string}}[];
  annotation_type?: string;
  data?: AnnotationResponse;
};

const SUMMARIZE_WORD_THRESHOLD = 25;

export function inferAnnotationMode(phrase: string): AnnotationMode {
  const trimmed = phrase.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= SUMMARIZE_WORD_THRESHOLD) return 'summarize';
  if (/[.!?]/.test(trimmed) && words.length >= 12) return 'summarize';
  return 'explain';
}

function postWithXhr(
  endpoint: string,
  headers: Record<string, string>,
  body: string,
): Promise<{status: number; text: string}> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', endpoint, true);
    Object.entries(headers).forEach(([key, value]) =>
      request.setRequestHeader(key, value),
    );
    request.onload = () =>
      resolve({status: request.status, text: request.responseText});
    request.onerror = () =>
      reject(new Error('GPT request could not reach the endpoint'));
    request.send(body);
  });
}

function extractContent(raw: unknown): string | null {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed || null;
  }
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const data = raw as AnnotationResponse;
  if (data.data) {
    const nested = extractContent(data.data);
    if (nested) return nested;
  }

  const candidates = [
    data.content,
    data.explanation,
    data.paraphrase,
    data.result,
    data.choices?.[0]?.message?.content,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function emptyResponseError(raw: unknown): Error {
  if (raw && typeof raw === 'object') {
    const data = raw as AnnotationResponse;
    if (typeof data.error === 'string' && data.error.trim()) {
      return new Error(data.error.trim());
    }
    if (typeof data.message === 'string' && data.message.trim()) {
      return new Error(data.message.trim());
    }
    if (Array.isArray(data.fields)) {
      return new Error(
        'Annotation got a forms-detect response. Check GPT_ENDPOINT_URL / Metro cache.',
      );
    }
  }
  return new Error('The annotation response was empty');
}

async function postAnnotationRequest(
  endpoint: string,
  headers: Record<string, string>,
  body: string,
): Promise<unknown> {
  let status = 0;
  let text = '';
  try {
    const response = await fetch(endpoint, {method: 'POST', headers, body});
    status = response.status;
    text = await response.text();
  } catch {
    const xhr = await postWithXhr(endpoint, headers, body);
    status = xhr.status;
    text = xhr.text;
  }

  if (status < 200 || status >= 300) {
    let message = `Annotation request failed (${status})`;
    try {
      const errJson = JSON.parse(text) as AnnotationResponse;
      message = errJson.error || errJson.message || message;
    } catch {
      // keep status message
    }
    throw new Error(message);
  }

  if (!text.trim()) {
    throw new Error('The annotation response was empty');
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function fetchPhraseAnnotation(
  phrase: string,
  options: FetchAnnotationOptions = {},
): Promise<PhraseAnnotation> {
  const selection = phrase.trim();
  const mode = options.mode ?? inferAnnotationMode(selection);
  const endpoint = getEnv().gptEndpointUrl;
  const context = options.context?.trim() || '';
  const pageNumber = options.pageNumber ?? 0;

  if (!selection) {
    throw new Error('Select a phrase first');
  }
  if (!endpoint) {
    throw new Error(
      'Annotate endpoint is not configured (set SUPABASE_URL or GPT_ENDPOINT_URL)',
    );
  }

  const anonKey = getEnv().supabaseAnonKey;
  const accessToken =
    useAuthStore.getState().session?.access_token || anonKey;
  if (!anonKey) {
    throw new Error('SUPABASE_ANON_KEY is not configured');
  }

  const customInstructions =
    usePreferencesStore.getState().preferences.customInstructions.trim().slice(0, 1000);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    apikey: anonKey,
  };
  const body = JSON.stringify({
    selection_text: selection,
    text: selection,
    page_number: pageNumber,
    annotation_type: mode,
    ...(context ? {context} : {}),
    ...(customInstructions ? {custom_instructions: customInstructions} : {}),
  });

  let lastRaw: unknown;
  let lastError: Error | null = null;

  // Native first (NSURLSession is reliable on macOS). If it resolves without
  // usable content (stale bridge / wrong endpoint shape), fall through to fetch.
  try {
    const nativeRaw = await annotatePhrase(
      endpoint,
      accessToken,
      anonKey,
      selection,
      pageNumber,
      mode,
      context,
      customInstructions,
    );
    lastRaw = nativeRaw;
    const nativeContent = extractContent(nativeRaw);
    if (nativeContent) {
      return {phrase: selection, content: nativeContent, mode};
    }
    lastError = emptyResponseError(nativeRaw);
  } catch (err) {
    lastError =
      err instanceof Error ? err : new Error('Native annotation failed');
  }

  try {
    const httpRaw = await postAnnotationRequest(endpoint, headers, body);
    lastRaw = httpRaw;
    const httpContent = extractContent(httpRaw);
    if (httpContent) {
      return {phrase: selection, content: httpContent, mode};
    }
    throw emptyResponseError(httpRaw);
  } catch (err) {
    if (lastError && !extractContent(lastRaw)) {
      // Prefer the HTTP error when native only returned an empty body.
      throw err instanceof Error ? err : lastError;
    }
    throw err instanceof Error
      ? err
      : lastError ?? new Error('Annotation request failed');
  }
}
