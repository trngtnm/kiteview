export type PickedPdfFile = {
  uri: string;
  name: string;
  /** Optional base64 payload from the native picker (preferred for sandboxed reads). */
  base64?: string;
};

export type PickPdfFileFn = () => Promise<PickedPdfFile | null>;
export type RenamePdfFileFn = (
  uri: string,
  name: string,
) => Promise<PickedPdfFile>;

let pickPdfFileImpl: PickPdfFileFn | null = null;
let renamePdfFileImpl: RenamePdfFileFn | null = null;

/** Register the platform-specific PDF picker (e.g. NSOpenPanel on macOS). */
export function registerPickPdfFile(fn: PickPdfFileFn): void {
  pickPdfFileImpl = fn;
}

export function registerRenamePdfFile(fn: RenamePdfFileFn): void {
  renamePdfFileImpl = fn;
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
