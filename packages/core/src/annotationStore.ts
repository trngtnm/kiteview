import {create} from 'zustand';
import {
  fetchPhraseAnnotation,
  inferAnnotationMode,
  type AnnotationMode,
  type PhraseAnnotation,
} from './annotation';

export type AnnotationStatus = 'idle' | 'loading' | 'ready' | 'error';

type AnnotationState = {
  activePhrase: string | null;
  pageNumber: number | undefined;
  context: string | undefined;
  mode: AnnotationMode;
  status: AnnotationStatus;
  annotation: PhraseAnnotation | null;
  error: string | null;
  requestAnnotation: (
    phrase: string,
    pageNumber?: number,
    mode?: AnnotationMode,
    context?: string,
  ) => Promise<void>;
  setMode: (mode: AnnotationMode) => void;
  clearAnnotation: () => void;
};

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  activePhrase: null,
  pageNumber: undefined,
  context: undefined,
  mode: 'explain',
  status: 'idle',
  annotation: null,
  error: null,
  clearAnnotation: () =>
    set({
      activePhrase: null,
      pageNumber: undefined,
      context: undefined,
      mode: 'explain',
      status: 'idle',
      annotation: null,
      error: null,
    }),
  setMode: mode => {
    const {activePhrase, pageNumber, context, mode: current} = get();
    if (mode === current) return;
    if (!activePhrase) {
      set({mode});
      return;
    }
    void get().requestAnnotation(activePhrase, pageNumber, mode, context);
  },
  requestAnnotation: async (phrase, pageNumber, mode, context) => {
    const trimmed = phrase.trim();
    if (!trimmed) return;
    const resolvedMode = mode ?? inferAnnotationMode(trimmed);
    const resolvedContext = context?.trim() || undefined;
    set({
      activePhrase: trimmed,
      pageNumber,
      context: resolvedContext,
      mode: resolvedMode,
      status: 'loading',
      error: null,
    });
    try {
      const annotation = await fetchPhraseAnnotation(trimmed, {
        pageNumber,
        mode: resolvedMode,
        context: resolvedContext,
      });
      if (get().activePhrase !== trimmed || get().mode !== resolvedMode) {
        return;
      }
      set({status: 'ready', annotation, error: null});
    } catch (err) {
      if (get().activePhrase !== trimmed || get().mode !== resolvedMode) {
        return;
      }
      set({
        status: 'error',
        annotation: null,
        error:
          err instanceof Error ? err.message : 'Could not annotate phrase',
      });
    }
  },
}));
