import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {WebView} from 'react-native-webview';
import type {DetectedFormField} from './formAnalysis';
import {buildPdfViewerHtml} from './pdfViewerHtml';
import type {
  FormPageImagePayload,
  PdfViewerHandle,
  PdfViewerProps,
} from './types';

type WebViewHost = {
  injectJavaScript?: (script: string) => void;
};

type WebViewMessage = {
  type: string;
  count?: number;
  message?: string;
  word?: string;
  pageNumber?: number;
  phrase?: string;
  content?: string;
  id?: string;
  value?: string;
  fields?: DetectedFormField[];
  pages?: FormPageImagePayload[];
};

// react-native-webview typings lag React 19; keep a loose host component.
const RNWebView = WebView as unknown as React.ComponentType<{
  ref?: React.Ref<WebViewHost | null>;
  originWhitelist?: string[];
  source?: {html: string; baseUrl?: string};
  style?: object;
  mixedContentMode?: string;
  showsHorizontalScrollIndicator?: boolean;
  showsVerticalScrollIndicator?: boolean;
  directionalLockEnabled?: boolean;
  onLoadEnd?: () => void;
  onMessage?: (event: {nativeEvent: {data: string}}) => void;
  onError?: (event: {nativeEvent: {description: string}}) => void;
}>;

function inject(
  webRef: React.RefObject<WebViewHost | null>,
  script: string,
) {
  webRef.current?.injectJavaScript?.(`${script}; true;`);
}

/**
 * Continuous-scroll PDF viewer powered by pdf.js (CDN) inside a WKWebView.
 * Form overlays are applied after load via injectJavaScript — never rebuild HTML.
 */
export function PdfViewer({
  viewerRef,
  sourceUri,
  base64,
  onPageCount,
  onPageReady,
  onError,
  onWordClick,
  onPhraseSelect,
  onPhraseAnnotation,
  onPhraseAnnotationError,
  gptEndpointUrl,
  supabaseAnonKey,
  formFields,
  selectedFieldId,
  onFormFieldClick,
  onFormFieldChange,
  onHeuristicFields,
  onFormPageImages,
}: PdfViewerProps) {
  const webRef = useRef<WebViewHost | null>(null);

  const dataUri = useMemo(() => {
    if (base64) {
      return `data:application/pdf;base64,${base64}`;
    }
    if (sourceUri.startsWith('data:')) {
      return sourceUri;
    }
    return null;
  }, [base64, sourceUri]);

  const html = useMemo(
    () =>
      dataUri
        ? buildPdfViewerHtml(dataUri, gptEndpointUrl, supabaseAnonKey)
        : null,
    [dataUri, gptEndpointUrl, supabaseAnonKey],
  );

  useImperativeHandle(viewerRef, () => ({
    runHeuristicDetect: () => {
      inject(
        webRef,
        'window.__kvRunHeuristicDetect && window.__kvRunHeuristicDetect()',
      );
    },
    capturePagesForDetect: (maxPages = 1) => {
      inject(
        webRef,
        `window.__kvCapturePagesForDetect && window.__kvCapturePagesForDetect(${Number(maxPages) || 1})`,
      );
    },
  }));

  const pushFormState = useCallback(() => {
    const payload = JSON.stringify(formFields ?? []);
    const id =
      selectedFieldId == null ? 'null' : JSON.stringify(selectedFieldId);
    inject(
      webRef,
      `window.__kvSetFormFields && window.__kvSetFormFields(${payload});` +
        `window.__kvSetSelectedField && window.__kvSetSelectedField(${id})`,
    );
  }, [formFields, selectedFieldId]);

  useEffect(() => {
    if (!html) return;
    pushFormState();
  }, [html, pushFormState]);

  if (!html) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          PDF data is unavailable. Re-open the file with Select file.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RNWebView
        ref={webRef}
        originWhitelist={['*']}
        source={{html, baseUrl: 'https://localhost/'}}
        style={styles.webview}
        mixedContentMode="always"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator
        directionalLockEnabled
        onLoadEnd={pushFormState}
        onMessage={event => {
          try {
            const data = JSON.parse(event.nativeEvent.data) as WebViewMessage;
            if (data.type === 'pageCount' && typeof data.count === 'number') {
              onPageCount?.(data.count);
            }
            if (
              data.type === 'pageReady' &&
              typeof data.pageNumber === 'number'
            ) {
              onPageReady?.(data.pageNumber);
            }
            if (data.type === 'error' && data.message) {
              onError?.(data.message);
            }
            if (
              data.type === 'wordClick' &&
              typeof data.word === 'string' &&
              typeof data.pageNumber === 'number'
            ) {
              onWordClick?.(data.word, data.pageNumber);
            }
            if (
              data.type === 'phraseSelect' &&
              typeof data.phrase === 'string' &&
              typeof data.pageNumber === 'number'
            ) {
              onPhraseSelect?.(data.phrase, data.pageNumber);
            }
            if (
              data.type === 'phraseAnnotation' &&
              typeof data.phrase === 'string' &&
              typeof data.content === 'string'
            ) {
              onPhraseAnnotation?.(data.phrase, data.content);
            }
            if (
              data.type === 'phraseAnnotationError' &&
              typeof data.phrase === 'string' &&
              typeof data.message === 'string'
            ) {
              onPhraseAnnotationError?.(data.phrase, data.message);
            }
            if (data.type === 'formFieldClick' && typeof data.id === 'string') {
              onFormFieldClick?.(data.id);
            }
            if (
              data.type === 'formFieldChange' &&
              typeof data.id === 'string' &&
              typeof data.value === 'string'
            ) {
              onFormFieldChange?.(data.id, data.value);
            }
            if (data.type === 'heuristicFields' && Array.isArray(data.fields)) {
              onHeuristicFields?.(data.fields);
            }
            if (data.type === 'formPageImages' && Array.isArray(data.pages)) {
              onFormPageImages?.(data.pages);
            }
          } catch {
            // ignore malformed messages
          }
        }}
        onError={syntheticEvent => {
          onError?.(syntheticEvent.nativeEvent.description);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  error: {
    color: '#C62828',
    fontSize: 14,
    textAlign: 'center',
  },
});
