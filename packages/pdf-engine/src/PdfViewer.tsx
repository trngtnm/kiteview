import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {WebView} from 'react-native-webview';
import {buildPdfViewerHtml} from './pdfViewerHtml';
import type {PdfViewerProps} from './types';

type WebViewMessage = {
  type: string;
  count?: number;
  message?: string;
  word?: string;
  pageNumber?: number;
  phrase?: string;
  content?: string;
};

/**
 * Continuous-scroll PDF viewer powered by pdf.js inside a WKWebView.
 * Prefer `base64` from the macOS file picker; falls back to data/file URIs.
 * Clicks on text-layer words emit `onWordClick`.
 */
export function PdfViewer({
  sourceUri,
  base64,
  onPageCount,
  onError,
  onWordClick,
  onPhraseSelect,
  onPhraseAnnotation,
  onPhraseAnnotationError,
  gptEndpointUrl,
  supabaseAnonKey,
}: PdfViewerProps) {
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
      <WebView
        originWhitelist={['*']}
        source={{html, baseUrl: 'https://localhost/'}}
        style={styles.webview}
        mixedContentMode="always"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator
        directionalLockEnabled
        onMessage={event => {
          try {
            const data = JSON.parse(event.nativeEvent.data) as WebViewMessage;
            if (data.type === 'pageCount' && typeof data.count === 'number') {
              onPageCount?.(data.count);
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
