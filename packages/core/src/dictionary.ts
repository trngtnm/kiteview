export type WordMeaning = {
  partOfSpeech: string;
  definitions: string[];
};

export type WordDefinition = {
  word: string;
  phonetic?: string;
  meanings: WordMeaning[];
};

type FreeDictionaryEntry = {
  word?: string;
  phonetic?: string;
  phonetics?: {text?: string}[];
  meanings?: {
    partOfSpeech?: string;
    definitions?: {definition?: string}[];
  }[];
};

type WiktionaryResponse = {
  en?: {
    partOfSpeech?: string;
    definitions?: {definition?: string}[];
  }[];
};

const FREE_DICT_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const WIKTIONARY_BASE =
  'https://en.wiktionary.org/api/rest_v1/page/definition';
const MAX_MEANINGS = 3;
const MAX_DEFS_PER_MEANING = 2;

const cache = new Map<string, WordDefinition>();
const inFlight = new Map<string, Promise<WordDefinition>>();

function normalizeFreeDictionary(
  entries: FreeDictionaryEntry[],
  fallbackWord: string,
): WordDefinition {
  const entry = entries[0] ?? {};
  const phonetic =
    entry.phonetic ||
    entry.phonetics?.find(p => p.text)?.text ||
    undefined;

  const meanings: WordMeaning[] = (entry.meanings ?? [])
    .slice(0, MAX_MEANINGS)
    .map(m => ({
      partOfSpeech: m.partOfSpeech ?? '',
      definitions: (m.definitions ?? [])
        .map(d => d.definition?.trim() ?? '')
        .filter(Boolean)
        .slice(0, MAX_DEFS_PER_MEANING),
    }))
    .filter(m => m.definitions.length > 0);

  return {
    word: entry.word || fallbackWord,
    phonetic,
    meanings,
  };
}

function normalizeWiktionary(
  data: WiktionaryResponse,
  fallbackWord: string,
): WordDefinition {
  const meanings: WordMeaning[] = (data.en ?? [])
    .slice(0, MAX_MEANINGS)
    .map(m => ({
      partOfSpeech: m.partOfSpeech ?? '',
      definitions: (m.definitions ?? [])
        .map(d =>
          (d.definition ?? '')
            // Wiktionary often returns HTML snippets; strip tags lightly.
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim(),
        )
        .filter(Boolean)
        .slice(0, MAX_DEFS_PER_MEANING),
    }))
    .filter(m => m.definitions.length > 0);

  return {
    word: fallbackWord,
    meanings,
  };
}

async function fetchFreeDictionary(
  key: string,
  displayWord: string,
  signal: AbortSignal,
): Promise<WordDefinition> {
  const response = await fetch(`${FREE_DICT_BASE}/${encodeURIComponent(key)}`, {
    signal,
  });
  if (response.status === 404) {
    throw new Error('No definition found');
  }
  if (!response.ok) {
    throw new Error(`Dictionary lookup failed (${response.status})`);
  }
  const json = (await response.json()) as FreeDictionaryEntry[];
  if (!Array.isArray(json) || json.length === 0) {
    throw new Error('No definition found');
  }
  const definition = normalizeFreeDictionary(json, displayWord);
  if (definition.meanings.length === 0) {
    throw new Error('No definition found');
  }
  return definition;
}

async function fetchWiktionary(
  key: string,
  displayWord: string,
  signal: AbortSignal,
): Promise<WordDefinition> {
  const response = await fetch(
    `${WIKTIONARY_BASE}/${encodeURIComponent(key)}`,
    {
      signal,
      headers: {Accept: 'application/json'},
    },
  );
  if (response.status === 404) {
    throw new Error('No definition found');
  }
  if (!response.ok) {
    throw new Error(`Wiktionary lookup failed (${response.status})`);
  }
  const json = (await response.json()) as WiktionaryResponse;
  const definition = normalizeWiktionary(json, displayWord);
  if (definition.meanings.length === 0) {
    throw new Error('No definition found');
  }
  return definition;
}

/**
 * Race sources; first successful definition wins. Loser is aborted.
 */
async function fetchFromNetwork(
  key: string,
  displayWord: string,
): Promise<WordDefinition> {
  const freeController = new AbortController();
  const wikiController = new AbortController();

  const freePromise = fetchFreeDictionary(
    key,
    displayWord,
    freeController.signal,
  ).then(def => ({source: 'free' as const, def}));

  const wikiPromise = fetchWiktionary(
    key,
    displayWord,
    wikiController.signal,
  ).then(def => ({source: 'wiki' as const, def}));

  try {
    const winner = await Promise.any([freePromise, wikiPromise]);
    if (winner.source === 'free') {
      wikiController.abort();
    } else {
      freeController.abort();
    }
    cache.set(key, winner.def);
    return winner.def;
  } catch (err) {
    freeController.abort();
    wikiController.abort();

    // Promise.any rejects with AggregateError when every source fails.
    if (err instanceof AggregateError) {
      const messages = err.errors.map(e =>
        e instanceof Error ? e.message : String(e),
      );
      if (messages.every(m => m === 'No definition found')) {
        throw new Error('No definition found');
      }
      throw new Error(messages[0] || 'Could not load definition');
    }
    throw err;
  }
}

export async function fetchWordDefinition(word: string): Promise<WordDefinition> {
  const displayWord = word.trim();
  const key = displayWord.toLowerCase();
  if (!key) {
    throw new Error('Empty word');
  }

  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const existing = inFlight.get(key);
  if (existing) {
    return existing;
  }

  const promise = fetchFromNetwork(key, displayWord).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}
