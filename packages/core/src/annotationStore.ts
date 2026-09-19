import {create} from 'zustand';
import {
  fetchPhraseAnnotation,
  inferAnnotationMode,
  type AnnotationMode,
  type PhraseAnnotation,
} from './annotation';
import type {RectNorm} from './pinnedAnnotationStore';

export type AnnotationStatus = 'idle' | 'loading' | 'ready' | 'error';

type AnnotationState = {
  activePhrase: string | null;
  pageNumber: number | undefined;
  context: string | undefined;
  rectNorm: RectNorm | undefined;
  mode: AnnotationMode;
  status: AnnotationStatus;
  annotation: PhraseAnnotation | null;
  error: string | null;
  /** When viewing a saved pin, track its id so the panel can unpin. */
  viewingPinnedId: string | null;
  requestAnnotation: (
    phrase: string,
    pageNumber?: number,
    mode?: AnnotationMode,
    context?: string,
    rectNorm?: RectNorm,
  ) => Promise<void>;
  showPinnedAnnotation: (pin: {
    id: string;
    phrase: string;
    content: string;
    mode: AnnotationMode;
    pageNumber: number;
    rectNorm: RectNorm;
  }) => void;
  setMode: (mode: AnnotationMode) => void;
  clearAnnotation: () => void;
};

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  activePhrase: null,
  pageNumber: undefined,
  context: undefined,
  rectNorm: undefined,
  mode: 'explain',
  status: 'idle',
  annotation: null,
  error: null,
  viewingPinnedId: null,
  clearAnnotation: () =>
    set({
      activePhrase: null,
      pageNumber: undefined,
      context: undefined,
      rectNorm: undefined,
      mode: 'explain',
      status: 'idle',
      annotation: null,
      error: null,
      viewingPinnedId: null,
    }),
  showPinnedAnnotation: pin =>
    set({
      activePhrase: pin.phrase,
      pageNumber: pin.pageNumber,
      context: undefined,
      rectNorm: pin.rectNorm,
      mode: pin.mode,
      status: 'ready',
      annotation: {
        phrase: pin.phrase,
        content: pin.content,
        mode: pin.mode,
      },
      error: null,
      viewingPinnedId: pin.id,
    }),
  setMode: mode => {
    const {activePhrase, pageNumber, context, rectNorm, mode: current, viewingPinnedId} =
      get();
    if (mode === current) return;
    if (viewingPinnedId) {
      // Viewing a saved pin — switching mode re-fetches but keeps geometry.
      if (!activePhrase) {
        set({mode});
        return;
      }
      void get().requestAnnotation(
        activePhrase,
        pageNumber,
        mode,
        context,
        rectNorm,
      );
      return;
    }
    if (!activePhrase) {
      set({mode});
      return;
    }
    void get().requestAnnotation(
      activePhrase,
      pageNumber,
      mode,
      context,
      rectNorm,
    );
  },
  requestAnnotation: async (phrase, pageNumber, mode, context, rectNorm) => {
    const trimmed = phrase.trim();
    if (!trimmed) return;
    const resolvedMode = mode ?? inferAnnotationMode(trimmed);
    const resolvedContext = context?.trim() || undefined;
    const resolvedRect = rectNorm ?? get().rectNorm;
    set({
      activePhrase: trimmed,
      pageNumber,
      context: resolvedContext,
      rectNorm: resolvedRect,
      mode: resolvedMode,
      status: 'loading',
      error: null,
      viewingPinnedId: null,
      annotation: null,
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
