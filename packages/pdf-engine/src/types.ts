import type {ComponentType} from 'react';

export type PdfViewerProps = {
  sourceUri: string;
  /** When provided, preferred over reading sourceUri from disk. */
  base64?: string;
  onPageCount?: (count: number) => void;
  onError?: (message: string) => void;
  onWordClick?: (word: string, pageNumber: number) => void;
  onPhraseSelect?: (phrase: string, pageNumber: number) => void;
  onPhraseAnnotation?: (phrase: string, content: string) => void;
  onPhraseAnnotationError?: (phrase: string, message: string) => void;
  gptEndpointUrl?: string;
  supabaseAnonKey?: string;
};

/**
 * Platform PDF viewer contract.
 * macOS uses a pdf.js WebView adapter; other platforms can swap implementations later.
 */
export type PdfViewerComponent = ComponentType<PdfViewerProps>;
