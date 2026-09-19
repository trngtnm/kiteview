import {
  PDFArray,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFSignature,
  PDFTextField,
  type PDFField,
  type PDFPage,
  type PDFWidgetAnnotation,
} from 'pdf-lib';
import type {
  DetectedFormField,
  FormAnalysisResult,
  FormFieldType,
  RectNorm,
} from './formTypes';

export type {
  DetectedFormField,
  FormAnalysisResult,
  FormFieldSource,
  FormFieldType,
  RectNorm,
} from './formTypes';

function mapFieldType(field: PDFField): FormFieldType {
  if (field instanceof PDFTextField) return 'text';
  if (field instanceof PDFCheckBox) return 'checkbox';
  if (field instanceof PDFRadioGroup) return 'radio';
  if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
    return 'dropdown';
  }
  if (field instanceof PDFSignature) return 'signature';
  return 'unknown';
}

type PageIndex = {
  pages: PDFPage[];
  /** Widget dict → page index, built once for O(1) fallback lookup. */
  annotToPage: Map<object, number>;
};

function buildPageIndex(pages: PDFPage[]): PageIndex {
  const annotToPage = new Map<object, number>();
  for (let i = 0; i < pages.length; i++) {
    try {
      const annots = pages[i].node.lookupMaybe(PDFName.of('Annots'), PDFArray);
      if (!annots) {
        continue;
      }
      for (let a = 0; a < annots.size(); a++) {
        const annot = annots.lookup(a);
        if (annot) {
          annotToPage.set(annot as object, i);
        }
      }
    } catch {
      // skip page
    }
  }
  return {pages, annotToPage};
}

function findPageForWidget(
  index: PageIndex,
  widget: PDFWidgetAnnotation,
): {page: PDFPage; index: number} | null {
  const {pages, annotToPage} = index;
  try {
    const pageRef = widget.P();
    if (pageRef) {
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].ref === pageRef) {
          return {page: pages[i], index: i};
        }
      }
    }
  } catch {
    // fall through to Annots index
  }

  const fromMap =
    annotToPage.get(widget.dict as object) ??
    annotToPage.get(widget as unknown as object);
  if (fromMap != null) {
    return {page: pages[fromMap], index: fromMap};
  }

  return null;
}

function toRectNorm(
  page: PDFPage,
  rect: {x: number; y: number; width: number; height: number},
): RectNorm {
  const {width: pageW, height: pageH} = page.getSize();
  if (pageW <= 0 || pageH <= 0) {
    return {x: 0, y: 0, w: 0, h: 0};
  }
  return {
    x: rect.x / pageW,
    y: (pageH - rect.y - rect.height) / pageH,
    w: rect.width / pageW,
    h: rect.height / pageH,
  };
}

function base64ToUint8Array(base64: string): Uint8Array {
  const cleaned = base64.includes(',')
    ? base64.slice(base64.indexOf(',') + 1)
    : base64;

  const g = globalThis as unknown as {atob?: (s: string) => string};
  if (typeof g.atob === 'function') {
    const binary = g.atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // React Native / Node: use buffer polyfill
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {Buffer: BufferCtor} = require('buffer') as {
    Buffer: {from: (data: string, enc: string) => Uint8Array};
  };
  return new Uint8Array(BufferCtor.from(cleaned, 'base64'));
}

/**
 * Client-side AcroForm analysis. Does not modify PDF bytes.
 */
export async function analyzePdfForms(
  base64: string,
): Promise<FormAnalysisResult> {
  try {
    if (!base64) {
      return {status: 'none', fields: []};
    }

    const bytes = base64ToUint8Array(base64);
    // Default parseSpeed yields to the event loop and feels multi-second on RN.
    const pdfDoc = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
      parseSpeed: Infinity,
    });

    let form;
    try {
      form = pdfDoc.getForm();
    } catch {
      return {status: 'none', fields: []};
    }

    const fields = form.getFields();
    if (fields.length === 0) {
      return {status: 'none', fields: []};
    }

    const pageIndex = buildPageIndex(pdfDoc.getPages());
    const detected: DetectedFormField[] = [];
    let widgetIndex = 0;

    for (const field of fields) {
      const name = field.getName() || `field_${widgetIndex}`;
      const type = mapFieldType(field);
      let isReadOnly = false;
      try {
        isReadOnly = field.isReadOnly();
      } catch {
        // ignore
      }

      const widgets = field.acroField.getWidgets();
      if (widgets.length === 0) {
        continue;
      }

      for (const widget of widgets) {
        widgetIndex += 1;
        let rect;
        try {
          rect = widget.getRectangle();
        } catch {
          continue;
        }

        const pageInfo = findPageForWidget(pageIndex, widget);
        if (!pageInfo) {
          continue;
        }

        const rectNorm = toRectNorm(pageInfo.page, rect);
        if (rectNorm.w <= 0 || rectNorm.h <= 0) {
          continue;
        }

        detected.push({
          id: `${name}__${widgetIndex}`,
          name,
          type,
          pageNumber: pageInfo.index + 1,
          rectNorm,
          isReadOnly,
          source: 'acroform',
        });
      }
    }

    if (detected.length === 0) {
      return {status: 'none', fields: []};
    }

    return {status: 'ready', fields: detected};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {status: 'error', fields: [], error: message};
  }
}
