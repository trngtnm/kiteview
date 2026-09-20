import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';

export type AppearanceMode = 'light' | 'dark';

const STORAGE_KEY = '@kiteview/appearance/v1';

type AppearanceState = {
  mode: AppearanceMode;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setMode: (mode: AppearanceMode) => void;
  toggleMode: () => void;
};

async function persist(mode: AppearanceMode): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Local-only preference; ignore storage failures.
  }
}

export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  mode: 'light',
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw === 'dark' || raw === 'light') {
        set({mode: raw, hydrated: true});
        return;
      }
    } catch {
      // fall through to default
    }
    set({hydrated: true});
  },

  setMode: mode => {
    set({mode});
    void persist(mode);
  },

  toggleMode: () => {
    const next: AppearanceMode = get().mode === 'dark' ? 'light' : 'dark';
    set({mode: next});
    void persist(next);
  },
}));
