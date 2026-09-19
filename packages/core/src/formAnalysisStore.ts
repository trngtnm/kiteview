import {create} from 'zustand';
import {
  analyzePdfForms,
  type DetectedFormField,
  type FormFieldSource,
} from '@kiteview/pdf-engine';
import {
  invokeFormsDetect,
  isSupabaseConfigured,
  type FormPageImage,
} from './supabaseClient';

export type FormAnalysisStatus = 'idle' | 'loading' | 'none' | 'ready' | 'error';
export type FormDetectionSource = FormFieldSource | null;

/**
 * Cascade stage after user opts into detect:
 * - idle: not requested
 * - acroform: running pdf-lib
 * - heuristic: need WebView text heuristics
 * - vision: sparse fallback (page 1 Edge only)
 * - done: finished
 */
export type FormCascadeStage =
  | 'idle'
  | 'acroform'
  | 'heuristic'
  | 'vision'
  | 'done';

/** Vision only when local stages leave fewer than this many fields. */
export const VISION_SPARSE_THRESHOLD = 3;

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
   * User-triggered detect only. Never call from file-open.
   * Publishes AcroForm immediately when found, then always continues to heuristics.
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

function shouldRunVision(fieldCount: number): boolean {
  return fieldCount < VISION_SPARSE_THRESHOLD && isSupabaseConfigured();
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

  startDetect: async (base64: string) => {
    set({
      status: 'loading',
      fields: [],
      selectedFieldId: null,
      fieldValues: {},
      error: null,
      detectionSource: null,
      cascadeStage: 'acroform',
    });

    const result = await analyzePdfForms(base64);
    if (result.status === 'error') {
      set({
        status: 'error',
        fields: [],
        fieldValues: {},
        error: result.error ?? 'Form analysis failed',
        detectionSource: null,
        cascadeStage: 'done',
      });
      return;
    }

    const acro =
      result.status === 'ready' && result.fields.length > 0
        ? withSource(result.fields, 'acroform')
        : [];

    // Publish AcroForm immediately when present, then always run heuristics.
    set({
      status: acro.length > 0 ? 'ready' : 'loading',
      fields: acro,
      fieldValues: {},
      error: null,
      detectionSource: acro.length > 0 ? 'acroform' : null,
      cascadeStage: 'heuristic',
    });
  },

  applyHeuristicFields: fields => {
    const incoming = withSource(fields, 'heuristic');
    const merged = mergeFields(get().fields, incoming);
    const source = bestSource(merged);

    if (merged.length === 0) {
      if (shouldRunVision(0)) {
        set({
          status: 'loading',
          fields: [],
          fieldValues: {},
          detectionSource: null,
          cascadeStage: 'vision',
          error: null,
        });
        return;
      }
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

    // Show heuristic/AcroForm results immediately.
    set({
      status: 'ready',
      fields: merged,
      error: null,
      detectionSource: source,
      cascadeStage: shouldRunVision(merged.length) ? 'vision' : 'done',
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

    // Keep existing overlays visible while vision runs.
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
      // Keep prior fields on vision failure.
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
