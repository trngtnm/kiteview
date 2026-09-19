import {create} from 'zustand';
import {
  fetchWordDefinition,
  type WordDefinition,
} from './dictionary';

export type DefinitionStatus = 'idle' | 'loading' | 'ready' | 'error';

type DefinitionState = {
  activeWord: string | null;
  status: DefinitionStatus;
  definition: WordDefinition | null;
  error: string | null;
  requestDefinition: (word: string) => Promise<void>;
  clearDefinition: () => void;
};

export const useDefinitionStore = create<DefinitionState>((set, get) => ({
  activeWord: null,
  status: 'idle',
  definition: null,
  error: null,

  clearDefinition: () =>
    set({
      activeWord: null,
      status: 'idle',
      definition: null,
      error: null,
    }),

  requestDefinition: async (word: string) => {
    const trimmed = word.trim();
    if (!trimmed) {
      return;
    }

    // Keep previous definition visible until the new result arrives.
    set({
      activeWord: trimmed,
      status: 'loading',
      error: null,
    });

    try {
      const definition = await fetchWordDefinition(trimmed);
      if (get().activeWord?.toLowerCase() !== trimmed.toLowerCase()) {
        return;
      }
      set({
        status: 'ready',
        definition,
        error: null,
      });
    } catch (err) {
      if (get().activeWord?.toLowerCase() !== trimmed.toLowerCase()) {
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Could not load definition';
      set({
        status: 'error',
        definition: null,
        error: message,
      });
    }
  },
}));
