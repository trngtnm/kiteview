import type {ComponentType, Ref} from 'react';
import type {DetectedFormField, RectNorm} from './formTypes';

export type FormPageImagePayload = {
  pageNumber: number;
  imageBase64: string;
  mimeType: 'image/jpeg';
};

export type PinnedAnnotationView = {
  id: string;
  phrase: string;
  content: string;
  pageNumber: number;
  rectNorm: RectNorm;
  side: 'left' | 'right';
};

export type PdfViewerHandle = {
  runHeuristicDetect: () => void;
  capturePagesForDetect: (maxPages?: number) => void;
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
  onPinnedAnnotationClick?: (id: string) => void;
  formFields?: DetectedFormField[];
  selectedFieldId?: string | null;
  onFormFieldClick?: (id: string) => void;
  onFormFieldChange?: (id: string, value: string) => void;
  onHeuristicFields?: (fields: DetectedFormField[]) => void;
  onFormPageImages?: (pages: FormPageImagePayload[]) => void;
};

/**
 * Platform PDF viewer contract.
 * macOS uses a pdf.js WebView adapter; other platforms can swap implementations later.
 */
export type PdfViewerComponent = ComponentType<PdfViewerProps>;
