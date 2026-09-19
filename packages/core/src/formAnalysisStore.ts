import {create} from 'zustand';
import type {DetectedFormField, FormFieldSource} from '@kiteview/pdf-engine';
import {
  invokeFormsDetect,
  isSupabaseConfigured,
  type FormPageImage,
} from './supabaseClient';

export type FormAnalysisStatus = 'idle' | 'loading' | 'none' | 'ready' | 'error';
export type FormDetectionSource = FormFieldSource | null;

/**
 * Cascade stage after user opts into AI scan:
 * - idle: not requested
 * - acroform: unused in hot path (kept for type compatibility)
 * - vision: page 1 Edge OpenAI (default AI scan)
 * - done: finished
 * - heuristic: retained for type compatibility; unused
 */
export type FormCascadeStage =
  | 'idle'
  | 'acroform'
  | 'heuristic'
  | 'vision'
  | 'done';

/** @deprecated Vision is the default AI scan path; threshold unused. */
export const VISION_SPARSE_THRESHOLD = 1;

const SOURCE_RANK: Record<FormFieldSource, number> = {
  acroform: 3,
  heuristic: 2,
  vision: 1,
};

type FormAnalysisState = {
  status: FormAnalysisStatus;
  fields: DetectedFormField[];
  selectedFieldId: string | null;
  /** Overlay-only values keyed by field id (not written into PDF bytes). */
  fieldValues: Record<string, string>;
  error: string | null;
  detectionSource: FormDetectionSource;
  cascadeStage: FormCascadeStage;
  /**
   * User-triggered AI scan. Never call from file-open.
   * Goes straight to page-1 vision (no blocking AcroForm parse).
   */
  startDetect: (base64: string) => Promise<void>;
  applyHeuristicFields: (fields: DetectedFormField[]) => void;
  applyVisionFromPages: (pages: FormPageImage[]) => Promise<void>;
  markNone: () => void;
  selectField: (id: string | null) => void;
  setFieldValue: (id: string, value: string) => void;
  clear: () => void;
};

function withSource(
  fields: DetectedFormField[],
  source: FormFieldSource,
): DetectedFormField[] {
  return fields.map(f => ({...f, source: f.source ?? source}));
}

function rectsOverlap(
  a: DetectedFormField['rectNorm'],
  b: DetectedFormField['rectNorm'],
): boolean {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  // Slightly strict so neighboring row blanks can coexist.
  const pad = 0.008;
  return !(
    ax2 - pad <= b.x ||
    bx2 - pad <= a.x ||
    ay2 - pad <= b.y ||
    by2 - pad <= a.y
  );
}

function sourceRank(field: DetectedFormField): number {
  return SOURCE_RANK[field.source ?? 'heuristic'] ?? 0;
}

/** Union fields; on overlap keep higher-trust source. */
export function mergeFields(
  existing: DetectedFormField[],
  incoming: DetectedFormField[],
): DetectedFormField[] {
  const out = [...existing];
  for (const next of incoming) {
    const idx = out.findIndex(
      f =>
        f.pageNumber === next.pageNumber &&
        rectsOverlap(f.rectNorm, next.rectNorm),
    );
    if (idx < 0) {
      out.push(next);
      continue;
    }
    if (sourceRank(next) > sourceRank(out[idx])) {
      out[idx] = next;
    }
  }
  return out;
}

function bestSource(fields: DetectedFormField[]): FormDetectionSource {
  if (fields.some(f => f.source === 'acroform')) return 'acroform';
  if (fields.some(f => f.source === 'heuristic')) return 'heuristic';
  if (fields.some(f => f.source === 'vision')) return 'vision';
  return null;
}

let formAnalysisModulePromise: Promise<
  typeof import('@kiteview/pdf-engine/src/formAnalysis')
> | null = null;

/** Optional warm of pdf-lib (unused on the vision hot path). */
export function preloadFormAnalysis(): void {
  if (!formAnalysisModulePromise) {
    formAnalysisModulePromise = import('@kiteview/pdf-engine/src/formAnalysis');
  }
}

export const useFormAnalysisStore = create<FormAnalysisState>((set, get) => ({
  status: 'idle',
  fields: [],
  selectedFieldId: null,
  fieldValues: {},
  error: null,
  detectionSource: null,
  cascadeStage: 'idle',

  clear: () =>
    set({
      status: 'idle',
      fields: [],
      selectedFieldId: null,
      fieldValues: {},
      error: null,
      detectionSource: null,
      cascadeStage: 'idle',
    }),

  selectField: id => set({selectedFieldId: id}),

  setFieldValue: (id, value) =>
    set(state => ({
      fieldValues: {...state.fieldValues, [id]: value},
    })),

  markNone: () =>
    set({
      status: 'none',
      fields: [],
      selectedFieldId: null,
      fieldValues: {},
      error: null,
      detectionSource: null,
      cascadeStage: 'done',
    }),

  startDetect: async (_base64: string) => {
    if (!isSupabaseConfigured()) {
      set({
        status: 'error',
        fields: [],
        selectedFieldId: null,
        fieldValues: {},
        error: 'AI scan needs Supabase configured in .env',
        detectionSource: null,
        cascadeStage: 'done',
      });
      return;
    }

    // Vision-only hot path — skip pdf-lib so scan feels as fast as before.
    set({
      status: 'loading',
      fields: [],
      selectedFieldId: null,
      fieldValues: {},
      error: null,
      detectionSource: null,
      cascadeStage: 'vision',
    });
  },

  /** Unused in AI-scan cascade; kept for type/API stability. */
  applyHeuristicFields: fields => {
    const incoming = withSource(fields, 'heuristic');
    const merged = mergeFields(get().fields, incoming);
    const source = bestSource(merged);

    if (merged.length === 0) {
      set({
        status: 'none',
        fields: [],
        selectedFieldId: null,
        fieldValues: {},
        error: null,
        detectionSource: null,
        cascadeStage: 'done',
      });
      return;
    }

    set({
      status: 'ready',
      fields: merged,
      error: null,
      detectionSource: source,
      cascadeStage: 'done',
    });
  },

  applyVisionFromPages: async pages => {
    const prior = get().fields;

    if (!isSupabaseConfigured()) {
      set({
        status: prior.length > 0 ? 'ready' : 'none',
        fields: prior,
        detectionSource: bestSource(prior),
        cascadeStage: 'done',
        error: null,
      });
      return;
    }

    set({
      status: prior.length > 0 ? 'ready' : 'loading',
      error: null,
      cascadeStage: 'vision',
    });

    try {
      const visionFields = withSource(await invokeFormsDetect(pages), 'vision');
      const merged = mergeFields(prior, visionFields);

      if (merged.length === 0) {
        set({
          status: 'none',
          fields: [],
          selectedFieldId: null,
          fieldValues: {},
          error: null,
          detectionSource: null,
          cascadeStage: 'done',
        });
        return;
      }

      set({
        status: 'ready',
        fields: merged,
        error: null,
        detectionSource: bestSource(merged),
        cascadeStage: 'done',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (prior.length > 0) {
        set({
          status: 'ready',
          fields: prior,
          detectionSource: bestSource(prior),
          cascadeStage: 'done',
          error: message,
        });
        return;
      }
      set({
        status: 'error',
        fields: [],
        selectedFieldId: null,
        fieldValues: {},
        error: message,
        detectionSource: null,
        cascadeStage: 'done',
      });
    }
  },
}));
