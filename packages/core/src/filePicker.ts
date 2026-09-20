export type PickedPdfFile = {
  uri: string;
  name: string;
  /** Optional base64 payload from the native picker (preferred for sandboxed reads). */
  base64?: string;
};

export type SavedPdfFile = {
  uri: string;
  name: string;
};

export type PickPdfFileFn = () => Promise<PickedPdfFile | null>;
export type RenamePdfFileFn = (
  uri: string,
  name: string,
) => Promise<PickedPdfFile>;
export type SavePdfBytesFn = (
  base64: string,
  suggestedName: string,
) => Promise<SavedPdfFile | null>;
export type AnnotatePhraseFn = (
  endpoint: string,
  accessToken: string,
  anonKey: string,
  phrase: string,
  pageNumber?: number,
  annotationType?: string,
  context?: string,
  customInstructions?: string,
) => Promise<unknown>;

let pickPdfFileImpl: PickPdfFileFn | null = null;
let renamePdfFileImpl: RenamePdfFileFn | null = null;
let savePdfBytesImpl: SavePdfBytesFn | null = null;
let annotatePhraseImpl: AnnotatePhraseFn | null = null;

/** Register the platform-specific PDF picker (e.g. NSOpenPanel on macOS). */
export function registerPickPdfFile(fn: PickPdfFileFn): void {
  pickPdfFileImpl = fn;
}

export function registerRenamePdfFile(fn: RenamePdfFileFn): void {
  renamePdfFileImpl = fn;
}

export function registerSavePdfBytes(fn: SavePdfBytesFn): void {
  savePdfBytesImpl = fn;
}

export function registerAnnotatePhrase(fn: AnnotatePhraseFn): void {
  annotatePhraseImpl = fn;
}

export function annotatePhrase(
  endpoint: string,
  accessToken: string,
  anonKey: string,
  phrase: string,
  pageNumber?: number,
  annotationType?: string,
  context?: string,
  customInstructions?: string,
): Promise<unknown> {
  if (!annotatePhraseImpl) {
    throw new Error('Native phrase annotation is not registered');
  }
  return annotatePhraseImpl(
    endpoint,
    accessToken,
    anonKey,
    phrase,
    pageNumber,
    annotationType,
    context,
    customInstructions,
  );
}

export async function pickPdfFile(): Promise<PickedPdfFile | null> {
  if (!pickPdfFileImpl) {
    throw new Error(
      'pickPdfFile is not registered. Call registerPickPdfFile() at app startup.',
    );
  }
  return pickPdfFileImpl();
}

export async function renamePdfFile(
  uri: string,
  name: string,
): Promise<PickedPdfFile> {
  if (!renamePdfFileImpl) {
    throw new Error(
      'renamePdfFile is not registered. Call registerRenamePdfFile at app startup.',
    );
  }
  return renamePdfFileImpl(uri, name);
}

export async function savePdfBytes(
  base64: string,
  suggestedName: string,
): Promise<SavedPdfFile | null> {
  if (!savePdfBytesImpl) {
    throw new Error(
      'savePdfBytes is not registered. Call registerSavePdfBytes at app startup.',
    );
  }
  return savePdfBytesImpl(base64, suggestedName);
}
