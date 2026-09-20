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
 * Cascade stage after user opts into scan:
 * - idle: not requested
 * - scanning: parallel AcroForm + heuristics + vision in flight
 * - vision / heuristic / acroform: legacy aliases treated as busy
 * - done: finished
 */
export type FormCascadeStage =
  | 'idle'
  | 'acroform'
  | 'heuristic'
  | 'vision'
  | 'scanning'
  | 'done';

/** @deprecated Unused; kept for API compatibility. */
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
  /** True while background pdf-lib AcroForm has not settled. */
  acroPending: boolean;
  /** True until WebView pdf.js widget scan has reported once. */
  webviewAcroPending: boolean;
  /** True while Edge vision has not settled (or was skipped). */
  visionPending: boolean;
  /** True until WebView heuristics have reported once. */
  heuristicPending: boolean;
  /** When true, heuristics/vision must not merge (real widgets found). */
  fallbacksSuppressed: boolean;
  /**
   * User-triggered scan. Never call from file-open.
   * Starts heuristics + vision immediately; AcroForm merges in parallel.
   */
  startDetect: (base64: string) => Promise<void>;
  /** Primary path: pdf.js Widget Tx fields from the open WebView document. */
  applyAcroformFields: (fields: DetectedFormField[]) => void;
  applyHeuristicFields: (fields: DetectedFormField[]) => void;
  applyVisionFromPages: (pages: FormPageImage[]) => Promise<void>;
  markNone: () => void;
  selectField: (id: string | null) => void;
  setFieldValue: (id: string, value: string) => void;
  clear: () => void;
};

/** Keep fillable write fields; drop checkbox/radio/dropdown for now. */
function toFillableFields(fields: DetectedFormField[]): DetectedFormField[] {
  return fields
    .filter(
      f =>
        f.type === 'text' ||
        f.type === 'date' ||
        f.type === 'signature' ||
        f.type === 'unknown',
    )
    .map(f => (f.type === 'unknown' ? {...f, type: 'text' as const} : f));
}

function withSource(
  fields: DetectedFormField[],
  source: FormFieldSource,
): DetectedFormField[] {
  return toFillableFields(
    fields.map(f => ({...f, source: f.source ?? source})),
  );
}

function rectsOverlap(
  a: DetectedFormField['rectNorm'],
  b: DetectedFormField['rectNorm'],
  pad = 0.008,
): boolean {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  return !(
    ax2 - pad <= b.x ||
    bx2 - pad <= a.x ||
    ay2 - pad <= b.y ||
    by2 - pad <= a.y
  );
}

function rectIoU(
  a: DetectedFormField['rectNorm'],
  b: DetectedFormField['rectNorm'],
): number {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const inter = ix * iy;
  if (inter <= 0) return 0;
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

/** True when two boxes are the same blank (overlap, IoU, or same-row near centers). */
function rectsNearDuplicate(
  a: DetectedFormField['rectNorm'],
  b: DetectedFormField['rectNorm'],
): boolean {
  if (rectsOverlap(a, b, 0.02)) return true;
  if (rectIoU(a, b) >= 0.12) return true;

  const acx = a.x + a.w / 2;
  const acy = a.y + a.h / 2;
  const bcx = b.x + b.w / 2;
  const bcy = b.y + b.h / 2;
  const dy = Math.abs(acy - bcy);
  const dx = Math.abs(acx - bcx);
  // Same line, centers close — typical heuristic vs vision near-miss.
  if (dy < 0.028 && dx < 0.1) return true;
  // Horizontally overlapping on the same line (stacked label/blank boxes).
  const hOverlap =
    Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.02;
  if (dy < 0.035 && hOverlap) return true;
  return false;
}

function normalizeFieldName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function namesSimilar(a: string, b: string): boolean {
  const na = normalizeFieldName(a);
  const nb = normalizeFieldName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 3 && nb.length >= 3 && (na.includes(nb) || nb.includes(na))) {
    return true;
  }
  return false;
}

function isSameField(a: DetectedFormField, b: DetectedFormField): boolean {
  if (a.pageNumber !== b.pageNumber) return false;
  if (rectsNearDuplicate(a.rectNorm, b.rectNorm)) return true;
  // Same semantic label on the same row → treat as duplicate even if boxes miss.
  if (!namesSimilar(a.name, b.name)) return false;
  const ay = a.rectNorm.y + a.rectNorm.h / 2;
  const by = b.rectNorm.y + b.rectNorm.h / 2;
  return Math.abs(ay - by) < 0.04;
}

function sourceRank(field: DetectedFormField): number {
  return SOURCE_RANK[field.source ?? 'heuristic'] ?? 0;
}

/** Prefer a more semantic label when keeping a higher-trust box. */
function pickName(keep: DetectedFormField, other: DetectedFormField): string {
  const a = (keep.name || '').trim();
  const b = (other.name || '').trim();
  if (!a) return b || keep.name;
  if (!b) return a;
  const generic =
    /^(field|text|checkbox|radio|dropdown|signature|unknown|heur_\d+|vision_\d+|\s)*\d*$/i;
  if (generic.test(a) && !generic.test(b)) return b;
  if (b.length > a.length + 2 && !generic.test(b)) return b;
  return a;
}

function preferField(
  keep: DetectedFormField,
  other: DetectedFormField,
): DetectedFormField {
  if (sourceRank(other) > sourceRank(keep)) {
    return {...other, name: pickName(other, keep)};
  }
  if (sourceRank(other) < sourceRank(keep)) {
    return {...keep, name: pickName(keep, other)};
  }
  return {...keep, name: pickName(keep, other)};
}

/** Union fields; collapse near-duplicates / same-name same-row. */
export function mergeFields(
  existing: DetectedFormField[],
  incoming: DetectedFormField[],
): DetectedFormField[] {
  const out = [...existing];
  for (const next of incoming) {
    const idx = out.findIndex(f => isSameField(f, next));
    if (idx < 0) {
      out.push(next);
      continue;
    }
    out[idx] = preferField(out[idx], next);
  }
  return dedupeFields(out);
}

/** Final pass: collapse any remaining near-duplicates left to right. */
export function dedupeFields(fields: DetectedFormField[]): DetectedFormField[] {
  const out: DetectedFormField[] = [];
  for (const field of fields) {
    const idx = out.findIndex(f => isSameField(f, field));
    if (idx < 0) {
      out.push(field);
      continue;
    }
    out[idx] = preferField(out[idx], field);
  }
  return out;
}

function bestSource(fields: DetectedFormField[]): FormDetectionSource {
  if (fields.some(f => f.source === 'acroform')) return 'acroform';
  if (fields.some(f => f.source === 'heuristic')) return 'heuristic';
  if (fields.some(f => f.source === 'vision')) return 'vision';
  return null;
}

/**
 * Heuristic/vision noise filter: only keep blanks that look like real form
 * write areas (underscore/gap heur_*, wet-ink signature/date, or typed widgets).
 */
function hasStrongFormSignal(field: DetectedFormField): boolean {
  if (field.source === 'acroform') return true;
  if (field.type === 'signature' || field.type === 'date') return true;
  const id = field.id || '';
  if (id.startsWith('wet_') || id.startsWith('heur_')) return true;
  return false;
}

function strongFormFields(fields: DetectedFormField[]): DetectedFormField[] {
  return fields.filter(hasStrongFormSignal);
}

/** Held while vision classifies document type; discarded on informative. */
let pendingHeuristicFields: DetectedFormField[] = [];

function clearPendingHeuristics() {
  pendingHeuristicFields = [];
}

function takePendingHeuristics(): DetectedFormField[] {
  const next = pendingHeuristicFields;
  pendingHeuristicFields = [];
  return next;
}

function finalizeAsNone(
  set: (
    partial:
      | Partial<FormAnalysisState>
      | ((s: FormAnalysisState) => Partial<FormAnalysisState>),
  ) => void,
) {
  clearPendingHeuristics();
  set({
    status: 'none',
    fields: [],
    selectedFieldId: null,
    fieldValues: {},
    detectionSource: null,
    error: null,
    cascadeStage: 'done',
    acroPending: false,
    webviewAcroPending: false,
    visionPending: false,
    heuristicPending: false,
  });
}

let formAnalysisModulePromise: Promise<
  typeof import('@kiteview/pdf-engine/src/formAnalysis')
> | null = null;

export function preloadFormAnalysis(): void {
  if (!formAnalysisModulePromise) {
    formAnalysisModulePromise = import('@kiteview/pdf-engine/src/formAnalysis');
  }
}

function loadFormAnalysis() {
  preloadFormAnalysis();
  return formAnalysisModulePromise!;
}

function publishMerged(
  set: (
    partial:
      | Partial<FormAnalysisState>
      | ((s: FormAnalysisState) => Partial<FormAnalysisState>),
  ) => void,
  get: () => FormAnalysisState,
  incoming: DetectedFormField[],
) {
  const merged = mergeFields(get().fields, incoming);
  const {acroPending, webviewAcroPending, visionPending, heuristicPending} =
    get();
  const stillBusy =
    acroPending || webviewAcroPending || visionPending || heuristicPending;

  if (merged.length === 0) {
    if (stillBusy) {
      set({
        status: 'loading',
        fields: [],
        detectionSource: null,
        error: null,
      });
      return;
    }
    set({
      status: 'none',
      fields: [],
      selectedFieldId: null,
      fieldValues: {},
      detectionSource: null,
      error: null,
      cascadeStage: 'done',
    });
    return;
  }

  set({
    status: 'ready',
    fields: merged,
    detectionSource: bestSource(merged),
    error: null,
    cascadeStage: stillBusy ? 'scanning' : 'done',
  });
}

function finishIfIdle(
  set: (
    partial:
      | Partial<FormAnalysisState>
      | ((s: FormAnalysisState) => Partial<FormAnalysisState>),
  ) => void,
  get: () => FormAnalysisState,
) {
  const state = get();
  if (
    state.acroPending ||
    state.webviewAcroPending ||
    state.visionPending ||
    state.heuristicPending
  ) {
    return;
  }
  if (state.fields.length === 0) {
    set({
      status: state.error ? 'error' : 'none',
      fields: [],
      selectedFieldId: null,
      fieldValues: {},
      cascadeStage: 'done',
      detectionSource: null,
    });
    return;
  }
  set({
    status: 'ready',
    cascadeStage: 'done',
    detectionSource: bestSource(state.fields),
  });
}

export const useFormAnalysisStore = create<FormAnalysisState>((set, get) => ({
  status: 'idle',
  fields: [],
  selectedFieldId: null,
  fieldValues: {},
  error: null,
  detectionSource: null,
  cascadeStage: 'idle',
  acroPending: false,
  webviewAcroPending: false,
  visionPending: false,
  heuristicPending: false,
  fallbacksSuppressed: false,

  clear: () => {
    clearPendingHeuristics();
    set({
      status: 'idle',
      fields: [],
      selectedFieldId: null,
      fieldValues: {},
      error: null,
      detectionSource: null,
      cascadeStage: 'idle',
      acroPending: false,
      webviewAcroPending: false,
      visionPending: false,
      heuristicPending: false,
      fallbacksSuppressed: false,
    });
  },

  selectField: id => set({selectedFieldId: id}),

  setFieldValue: (id, value) =>
    set(state => ({
      fieldValues: {...state.fieldValues, [id]: value},
    })),

  markNone: () => {
    clearPendingHeuristics();
    set({
      status: 'none',
      fields: [],
      selectedFieldId: null,
      fieldValues: {},
      error: null,
      detectionSource: null,
      cascadeStage: 'done',
      acroPending: false,
      webviewAcroPending: false,
      visionPending: false,
      heuristicPending: false,
      fallbacksSuppressed: false,
    });
  },

  startDetect: async (base64: string) => {
    const wantVision = isSupabaseConfigured();
    clearPendingHeuristics();

    set({
      status: 'loading',
      fields: [],
      selectedFieldId: null,
      fieldValues: {},
      error: null,
      detectionSource: null,
      cascadeStage: 'scanning',
      acroPending: true,
      webviewAcroPending: true,
      visionPending: wantVision,
      heuristicPending: true,
      fallbacksSuppressed: false,
    });

    // pdf-lib AcroForm in parallel (fails on some LiveCycle PDFs; WebView is primary).
    void (async () => {
      try {
        const {analyzePdfForms} = await loadFormAnalysis();
        const result = await analyzePdfForms(base64);
        if (get().cascadeStage === 'idle') return;

        if (result.status === 'error') {
          set({
            acroPending: false,
            error: get().fields.length > 0 ? get().error : result.error ?? null,
          });
          finishIfIdle(set, get);
          return;
        }

        const acro =
          result.status === 'ready' && result.fields.length > 0
            ? withSource(result.fields, 'acroform')
            : [];
        set({acroPending: false});
        if (get().fallbacksSuppressed) {
          finishIfIdle(set, get);
          return;
        }
        if (acro.length > 0) {
          publishMerged(set, get, acro);
          set({
            fallbacksSuppressed: true,
            heuristicPending: false,
            visionPending: false,
          });
          finishIfIdle(set, get);
        } else {
          finishIfIdle(set, get);
        }
      } catch (err) {
        if (get().cascadeStage === 'idle') return;
        const message = err instanceof Error ? err.message : String(err);
        set({
          acroPending: false,
          error: get().fields.length > 0 ? get().error : message,
        });
        finishIfIdle(set, get);
      }
    })();
  },

  applyAcroformFields: fields => {
    const stage = get().cascadeStage;
    if (stage !== 'scanning' && stage !== 'acroform' && stage !== 'heuristic') {
      return;
    }
    const incoming = withSource(fields, 'acroform');
    if (incoming.length > 0) {
      // Replace — do not keep heuristic/vision junk alongside real widgets.
      // WebView widgets are authoritative; stop waiting on pdf-lib / fallbacks.
      clearPendingHeuristics();
      set({
        webviewAcroPending: false,
        acroPending: false,
        fallbacksSuppressed: true,
        heuristicPending: false,
        visionPending: false,
        status: 'ready',
        fields: incoming,
        detectionSource: 'acroform',
        error: null,
        cascadeStage: 'done',
        selectedFieldId: null,
        fieldValues: {},
      });
      return;
    }
    set({webviewAcroPending: false});
    // Widgets missed — flush any heuristics held while Acro was pending,
    // unless vision still owns document-type classification.
    if (!get().visionPending && pendingHeuristicFields.length > 0) {
      const held = takePendingHeuristics();
      if (held.length > 0) {
        publishMerged(set, get, held);
      }
    }
    finishIfIdle(set, get);
  },

  applyHeuristicFields: fields => {
    const stage = get().cascadeStage;
    if (stage !== 'scanning' && stage !== 'vision' && stage !== 'heuristic') {
      return;
    }
    if (get().fallbacksSuppressed) {
      set({heuristicPending: false});
      finishIfIdle(set, get);
      return;
    }
    // Only keep underscore/wet-ink style blanks — ignore weak noise.
    const incoming = strongFormFields(withSource(fields, 'heuristic'));
    set({heuristicPending: false});

    // Wait for real widgets and/or vision document-type before publishing.
    if (get().webviewAcroPending || get().visionPending) {
      pendingHeuristicFields = incoming;
      finishIfIdle(set, get);
      return;
    }

    if (incoming.length > 0) {
      publishMerged(set, get, incoming);
    }
    finishIfIdle(set, get);
  },

  applyVisionFromPages: async pages => {
    if (get().fallbacksSuppressed || get().webviewAcroPending) {
      clearPendingHeuristics();
      set({visionPending: false});
      finishIfIdle(set, get);
      return;
    }

    if (!isSupabaseConfigured()) {
      set({visionPending: false});
      const held = takePendingHeuristics();
      if (held.length > 0) {
        publishMerged(set, get, held);
      }
      finishIfIdle(set, get);
      return;
    }

    try {
      const result = await invokeFormsDetect(pages);
      if (get().cascadeStage === 'idle') return;
      if (get().fallbacksSuppressed) {
        clearPendingHeuristics();
        set({visionPending: false});
        finishIfIdle(set, get);
        return;
      }
      set({visionPending: false});

      if (result.documentType === 'informative') {
        // Vision says not a form — discard layout/vision speculation entirely.
        finalizeAsNone(set);
        return;
      }

      const held = takePendingHeuristics();
      const visionFields = withSource(result.fields, 'vision');
      const incoming = mergeFields(held, visionFields);
      if (incoming.length > 0) {
        publishMerged(set, get, incoming);
      }
      finishIfIdle(set, get);
    } catch (err) {
      if (get().cascadeStage === 'idle') return;
      const message = err instanceof Error ? err.message : String(err);
      set({visionPending: false});
      // Vision failed: fall back to held layout blanks only.
      const held = takePendingHeuristics();
      if (held.length > 0) {
        publishMerged(set, get, held);
        set({error: message});
        finishIfIdle(set, get);
        return;
      }
      const current = get().fields;
      set({
        error: message,
        status: current.length > 0 ? 'ready' : get().acroPending ? 'loading' : 'error',
        fields: current,
        detectionSource: bestSource(current),
      });
      finishIfIdle(set, get);
    }
  },
}));
