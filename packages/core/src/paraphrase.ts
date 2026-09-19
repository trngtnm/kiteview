import {getEnv} from './env';
import {annotatePhrase} from './filePicker';

export type PhraseAnnotation = {
  phrase: string;
  content: string;
};

type AnnotationResponse = {
  paraphrase?: string;
  explanation?: string;
  content?: string;
  result?: string;
  choices?: {message?: {content?: string}}[];
  fields?: unknown[];
};

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
    request.onload = () => resolve({status: request.status, text: request.responseText});
    request.onerror = () => reject(new Error('GPT request could not reach the endpoint'));
    request.send(body);
  });
}

export async function fetchPhraseAnnotation(
  phrase: string,
  pageNumber?: number,
): Promise<PhraseAnnotation> {
  const selection = phrase.trim();
  const endpoint = getEnv().gptEndpointUrl;
  const instruction =
    'Explain the selected phrase in clear layman terms and briefly describe what it means in context.';
  if (!selection) {
    throw new Error('Select a phrase first');
  }
  if (!endpoint) {
    throw new Error('GPT endpoint is not configured');
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getEnv().supabaseAnonKey}`,
    apikey: getEnv().supabaseAnonKey,
  };
  const body = JSON.stringify({
      selection_text: selection,
      text: selection,
      page_number: pageNumber,
      annotation_type: 'paraphrase',
      instruction,
      prompt: `${instruction}\n\nSelected phrase: ${selection}`,
      messages: [
        {role: 'system', content: instruction},
        {role: 'user', content: selection},
      ],
  });

  let raw: unknown;
  try {
    raw = await annotatePhrase(
      endpoint,
      getEnv().supabaseAnonKey,
      selection,
      pageNumber,
    );
  } catch {
    const response = await fetch(endpoint, {method: 'POST', headers, body});
    if (!response.ok) {
      throw new Error(`Paraphrase request failed (${response.status})`);
    }
    raw = await response.json();
  }

  const data = raw as AnnotationResponse;
  const content =
    data.paraphrase ||
    data.explanation ||
    data.content ||
    data.result ||
    data.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    if (Array.isArray(data.fields)) {
      throw new Error(
        'The GPT endpoint returned no paraphrase. Check its annotation request contract.',
      );
    }
    throw new Error('The paraphrase response was empty');
  }

  return {phrase: selection, content: content.trim()};
}
