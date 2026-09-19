export type {
  PdfViewerProps,
  PdfViewerComponent,
  PdfViewerHandle,
  FormPageImagePayload,
  PinnedAnnotationView,
} from './types';
export {PdfViewer} from './PdfViewer';
export {buildPdfViewerHtml} from './pdfViewerHtml';
/** Types only — keeps pdf-lib out of the default reader bundle. */
export type {
  DetectedFormField,
  FormAnalysisResult,
  FormFieldType,
  FormFieldSource,
  RectNorm,
} from './formTypes';
