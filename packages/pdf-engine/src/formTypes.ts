export type FormFieldType =
  | 'text'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'signature'
  | 'unknown';

export type RectNorm = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type FormFieldSource = 'acroform' | 'heuristic' | 'vision';

export type DetectedFormField = {
  id: string;
  name: string;
  type: FormFieldType;
  pageNumber: number;
  rectNorm: RectNorm;
  isReadOnly?: boolean;
  source?: FormFieldSource;
};

export type FormAnalysisResult = {
  status: 'none' | 'ready' | 'error';
  fields: DetectedFormField[];
  error?: string;
};
