/**
 * KiteView — macOS reader shell
 * @format
 */

import React, {useCallback} from 'react';
import {Alert} from 'react-native';
import {
  pickPdfFile,
  useDocumentStore,
} from '@kiteview/core';
import {PdfViewer} from '@kiteview/pdf-engine';
import {ReaderShell} from '@kiteview/ui';
import {bootstrapEnv} from './src/bootstrapEnv';
import {registerMacosPdfPicker} from './src/registerMacosPdfPicker';

bootstrapEnv();
registerMacosPdfPicker();

function App() {
  const file = useDocumentStore(s => s.file);
  const setFile = useDocumentStore(s => s.setFile);
  const clearFile = useDocumentStore(s => s.clearFile);

  const onSelectFile = useCallback(async () => {
    try {
      const picked = await pickPdfFile();
      if (picked) {
        setFile(picked);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Could not open file', message);
    }
  }, [setFile]);

  return (
    <ReaderShell
      fileName={file?.name}
      onSelectFile={onSelectFile}
      onClearFile={file ? clearFile : undefined}>
      {file ? (
        <PdfViewer
          sourceUri={file.uri}
          base64={file.base64}
          onError={message => Alert.alert('PDF error', message)}
        />
      ) : null}
    </ReaderShell>
  );
}

export default App;
