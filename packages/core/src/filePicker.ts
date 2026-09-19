export type PickedPdfFile = {
  uri: string;
  name: string;
  /** Optional base64 payload from the native picker (preferred for sandboxed reads). */
  base64?: string;
};

export type PickPdfFileFn = () => Promise<PickedPdfFile | null>;

let pickPdfFileImpl: PickPdfFileFn | null = null;

/** Register the platform-specific PDF picker (e.g. NSOpenPanel on macOS). */
export function registerPickPdfFile(fn: PickPdfFileFn): void {
  pickPdfFileImpl = fn;
}

export async function pickPdfFile(): Promise<PickedPdfFile | null> {
  if (!pickPdfFileImpl) {
    throw new Error(
      'pickPdfFile is not registered. Call registerPickPdfFile() at app startup.',
    );
  }
  return pickPdfFileImpl();
}
