import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import type {AnnotationMode} from './annotation';

export type RectNorm = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PinnedAnnotation = {
  id: string;
  documentKey: string;
  phrase: string;
  content: string;
  mode: AnnotationMode;
  pageNumber: number;
  rectNorm: RectNorm;
  side: 'left' | 'right';
  createdAt: number;
};

export type PinAnnotationInput = {
  documentKey: string;
  phrase: string;
  content: string;
  mode: AnnotationMode;
  pageNumber: number;
  rectNorm: RectNorm;
};

const STORAGE_KEY = '@kiteview/pinned-annotations/v1';

/** In-memory mirror so pin still works if AsyncStorage native module is missing. */
let memoryPins: PinnedAnnotation[] | null = null;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function chooseMarginSide(rectNorm: RectNorm): 'left' | 'right' {
  const centerX = clamp01(rectNorm.x) + clamp01(rectNorm.w) / 2;
  return centerX < 0.5 ? 'right' : 'left';
}

function makeId(): string {
  return `pin_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readAll(): Promise<PinnedAnnotation[]> {
  if (memoryPins) {
    return memoryPins;
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      memoryPins = [];
      return memoryPins;
    }
    const parsed = JSON.parse(raw) as unknown;
    memoryPins = Array.isArray(parsed) ? (parsed as PinnedAnnotation[]) : [];
    return memoryPins;
  } catch {
    memoryPins = memoryPins ?? [];
    return memoryPins;
  }
}

async function writeAll(items: PinnedAnnotation[]): Promise<void> {
  memoryPins = items;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Keep in-memory pins for this session.
  }
}

type PinnedAnnotationState = {
  documentKey: string | null;
  pins: PinnedAnnotation[];
  selectedId: string | null;
  hydrated: boolean;
  loadForDocument: (documentKey: string) => Promise<void>;
  pinAnnotation: (input: PinAnnotationInput) => Promise<PinnedAnnotation | null>;
  unpinAnnotation: (id: string) => Promise<void>;
  selectPinned: (id: string | null) => void;
  clearActive: () => void;
  clearDocument: () => void;
};

export const usePinnedAnnotationStore = create<PinnedAnnotationState>(
  (set, get) => ({
    documentKey: null,
    pins: [],
    selectedId: null,
    hydrated: false,
    clearActive: () => set({selectedId: null}),
    clearDocument: () =>
      set({documentKey: null, pins: [], selectedId: null, hydrated: false}),
    selectPinned: id => set({selectedId: id}),
    loadForDocument: async documentKey => {
      const key = documentKey.trim();
      if (!key) {
        set({documentKey: null, pins: [], selectedId: null, hydrated: true});
        return;
      }
      const all = await readAll();
      const pins = all
        .filter(p => p.documentKey === key)
        .sort((a, b) => a.createdAt - b.createdAt);
      set({
        documentKey: key,
        pins,
        selectedId: null,
        hydrated: true,
      });
    },
    pinAnnotation: async input => {
      try {
        const documentKey = input.documentKey.trim();
        const phrase = input.phrase.trim();
        const content = input.content.trim();
        if (!documentKey || !phrase || !content) return null;

        const rectNorm: RectNorm = {
          x: clamp01(input.rectNorm.x),
          y: clamp01(input.rectNorm.y),
          w: clamp01(input.rectNorm.w),
          h: clamp01(input.rectNorm.h),
        };
        if (rectNorm.w <= 0 || rectNorm.h <= 0) return null;

        const pin: PinnedAnnotation = {
          id: makeId(),
          documentKey,
          phrase,
          content,
          mode: input.mode,
          pageNumber: Math.max(1, Math.floor(input.pageNumber) || 1),
          rectNorm,
          side: chooseMarginSide(rectNorm),
          createdAt: Date.now(),
        };

        const all = await readAll();
        const nextAll = all.filter(existing => {
          if (existing.documentKey !== documentKey) return true;
          if (existing.pageNumber !== pin.pageNumber) return true;
          const dx = Math.abs(existing.rectNorm.x - pin.rectNorm.x);
          const dy = Math.abs(existing.rectNorm.y - pin.rectNorm.y);
          const samePhrase =
            existing.phrase.trim().toLowerCase() === phrase.toLowerCase();
          return !(samePhrase && dx < 0.02 && dy < 0.02);
        });
        nextAll.push(pin);
        await writeAll(nextAll);

        const pins = nextAll
          .filter(p => p.documentKey === documentKey)
          .sort((a, b) => a.createdAt - b.createdAt);
        set({documentKey, pins, selectedId: pin.id, hydrated: true});
        return pin;
      } catch {
        return null;
      }
    },
    unpinAnnotation: async id => {
      try {
        const all = await readAll();
        const nextAll = all.filter(p => p.id !== id);
        await writeAll(nextAll);
        const {documentKey, selectedId} = get();
        const pins = documentKey
          ? nextAll
              .filter(p => p.documentKey === documentKey)
              .sort((a, b) => a.createdAt - b.createdAt)
          : [];
        set({
          pins,
          selectedId: selectedId === id ? null : selectedId,
        });
      } catch {
        // ignore
      }
    },
  }),
);
