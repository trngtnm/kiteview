import type {ComponentType, Ref} from 'react';
import type {DetectedFormField, RectNorm} from './formTypes';

export type FormPageImagePayload = {
  pageNumber: number;
  imageBase64: string;
  mimeType: 'image/jpeg';
  width?: number;
  height?: number;
};

export type PinnedAnnotationView = {
  id: string;
  phrase: string;
  content: string;
  pageNumber: number;
  rectNorm: RectNorm;
  side: 'left' | 'right';
  userComment?: string;
};

/** Live / expanded annotation card painted in the PDF margin next to the selection. */
export type ActiveMarginAnnotation = {
  phrase: string;
  content: string;
  status: 'loading' | 'ready' | 'error';
  error?: string | null;
  pageNumber: number;
  rectNorm: RectNorm;
  side: 'left' | 'right';
  pinId?: string | null;
  userComment?: string;
};

export type PdfViewerHandle = {
  runHeuristicDetect: () => void;
  runAcroformDetect: () => void;
  capturePagesForDetect: (maxPages?: number) => void;
  /**
   * Push field values into the WebView and return page JPEGs with text burned in.
   */
  exportFilledPages: (
    values: Record<string, string>,
  ) => Promise<FormPageImagePayload[]>;
};

export type PdfViewerProps = {
  /** Imperative form-detect helpers (avoid JSX `ref` — RN/TS strips it). */
  viewerRef?: Ref<PdfViewerHandle | null>;
  sourceUri: string;
  /** When provided, preferred over reading sourceUri from disk. */
  base64?: string;
  onPageCount?: (count: number) => void;
  onPageReady?: (pageNumber: number) => void;
  onError?: (message: string) => void;
  onWordClick?: (word: string, pageNumber: number) => void;
  onPhraseSelect?: (
    phrase: string,
    pageNumber: number,
    context?: string,
    rectNorm?: RectNorm,
  ) => void;
  pinnedAnnotations?: PinnedAnnotationView[];
  selectedPinnedId?: string | null;
  activeMarginAnnotation?: ActiveMarginAnnotation | null;
  colorScheme?: 'light' | 'dark';
  onPinnedAnnotationClick?: (
    id: string,
    source?: 'highlight' | 'note',
    action?: 'expand' | 'open',
  ) => void;
  formFields?: DetectedFormField[];
  selectedFieldId?: string | null;
  onFormFieldClick?: (id: string) => void;
  onFormFieldChange?: (id: string, value: string) => void;
  onHeuristicFields?: (fields: DetectedFormField[]) => void;
  onAcroformFields?: (fields: DetectedFormField[]) => void;
  onFormPageImages?: (pages: FormPageImagePayload[]) => void;
};

/**
 * Platform PDF viewer contract.
 * macOS uses a pdf.js WebView adapter; other platforms can swap implementations later.
 */
export type PdfViewerComponent = ComponentType<PdfViewerProps>;
