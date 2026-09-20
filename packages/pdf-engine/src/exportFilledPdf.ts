import {PDFDocument} from 'pdf-lib';
import type {FormPageImagePayload} from './types';

function decodeBase64(b64: string): Uint8Array {
  const raw = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64;
  if (typeof atob === 'function') {
    const bin = atob(raw);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }
  // Node / RN with Buffer
  const Buf = (globalThis as {Buffer?: {from: (s: string, enc: string) => Uint8Array}})
    .Buffer;
  if (Buf) {
    return new Uint8Array(Buf.from(raw, 'base64'));
  }
  throw new Error('No base64 decoder available');
}

function encodeBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      const slice = bytes.subarray(i, i + chunk);
      binary += String.fromCharCode.apply(
        null,
        Array.from(slice) as unknown as number[],
      );
    }
    return btoa(binary);
  }
  const Buf = (
    globalThis as {
      Buffer?: {from: (b: Uint8Array) => {toString: (e: string) => string}};
    }
  ).Buffer;
  if (Buf) {
    return Buf.from(bytes).toString('base64');
  }
  throw new Error('No base64 encoder available');
}

/**
 * Build a new multipage PDF from raster page images with burned-in form text.
 * Does not parse the original PDF (required for LiveCycle / encrypted forms).
 */
export async function exportFilledPdfFromPageImages(
  pages: FormPageImagePayload[],
): Promise<{bytes: Uint8Array; base64: string}> {
  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  if (sorted.length === 0) {
    throw new Error('No pages to export');
  }

  const pdf = await PDFDocument.create();
  for (const page of sorted) {
    const bytes = decodeBase64(page.imageBase64);
    const jpg = await pdf.embedJpg(bytes);
    const width = page.width || jpg.width;
    const height = page.height || jpg.height;
    const pdfPage = pdf.addPage([width, height]);
    pdfPage.drawImage(jpg, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  const out = await pdf.save();
  const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
  return {bytes, base64: encodeBase64(bytes)};
}
