import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {WebView} from 'react-native-webview';
import {buildPdfViewerHtml} from './pdfViewerHtml';
import type {PdfViewerProps} from './types';

/**
 * Continuous-scroll PDF viewer powered by pdf.js inside a WKWebView.
 * Prefer `base64` from the macOS file picker; falls back to data/file URIs.
 */
export function PdfViewer({
  sourceUri,
  base64,
  onPageCount,
  onError,
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
    () => (dataUri ? buildPdfViewerHtml(dataUri) : null),
    [dataUri],
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
            const data = JSON.parse(event.nativeEvent.data) as {
              type: string;
              count?: number;
              message?: string;
            };
            if (data.type === 'pageCount' && typeof data.count === 'number') {
              onPageCount?.(data.count);
            }
            if (data.type === 'error' && data.message) {
              onError?.(data.message);
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
