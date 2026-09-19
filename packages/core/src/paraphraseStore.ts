import {create} from 'zustand';
import {fetchPhraseAnnotation, type PhraseAnnotation} from './paraphrase';

export type ParaphraseStatus = 'idle' | 'loading' | 'ready' | 'error';

type ParaphraseState = {
  activePhrase: string | null;
  status: ParaphraseStatus;
  annotation: PhraseAnnotation | null;
  error: string | null;
  beginParaphrase: (phrase: string) => void;
  receiveParaphrase: (phrase: string, content: string) => void;
  failParaphrase: (phrase: string, error: string) => void;
  requestParaphrase: (phrase: string, pageNumber?: number) => Promise<void>;
  clearParaphrase: () => void;
};

export const useParaphraseStore = create<ParaphraseState>((set, get) => ({
  activePhrase: null,
  status: 'idle',
  annotation: null,
  error: null,
  beginParaphrase: phrase =>
    set({activePhrase: phrase.trim(), status: 'loading', error: null}),
  receiveParaphrase: (phrase, content) =>
    set(state =>
      state.activePhrase === phrase
        ? {
            status: 'ready',
            annotation: {phrase, content},
            error: null,
          }
        : state,
    ),
  failParaphrase: (phrase, error) =>
    set(state =>
      state.activePhrase === phrase
        ? {status: 'error', annotation: null, error}
        : state,
    ),
  clearParaphrase: () =>
    set({activePhrase: null, status: 'idle', annotation: null, error: null}),
  requestParaphrase: async (phrase, pageNumber) => {
    const trimmed = phrase.trim();
    if (!trimmed) return;
    set({activePhrase: trimmed, status: 'loading', error: null});
    try {
      const annotation = await fetchPhraseAnnotation(trimmed, pageNumber);
      if (get().activePhrase !== trimmed) return;
      set({status: 'ready', annotation, error: null});
    } catch (err) {
      if (get().activePhrase !== trimmed) return;
      set({
        status: 'error',
        annotation: null,
        error: err instanceof Error ? err.message : 'Could not paraphrase phrase',
      });
    }
  },
}));
