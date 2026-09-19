/**
 * KiteView — macOS reader shell
 * @format
 */

import React, {useCallback} from 'react';
import {Alert} from 'react-native';
import {
  pickPdfFile,
  renamePdfFile,
  useDefinitionStore,
  useDocumentStore,
} from '@kiteview/core';
import {PdfViewer} from '@kiteview/pdf-engine';
import {DefinitionPanel, ReaderShell} from '@kiteview/ui';
import {bootstrapEnv} from './src/bootstrapEnv';
import {registerMacosPdfPicker} from './src/registerMacosPdfPicker';

bootstrapEnv();
registerMacosPdfPicker();

function App() {
  const file = useDocumentStore(s => s.file);
  const tabs = useDocumentStore(s => s.tabs);
  const activeTabId = useDocumentStore(s => s.activeTabId);
  const setFile = useDocumentStore(s => s.setFile);
  const updateFile = useDocumentStore(s => s.updateFile);
  const selectTab = useDocumentStore(s => s.selectTab);
  const closeTab = useDocumentStore(s => s.closeTab);
  const renameFile = useDocumentStore(s => s.renameFile);
  const clearFile = useDocumentStore(s => s.clearFile);

  const activeWord = useDefinitionStore(s => s.activeWord);
  const status = useDefinitionStore(s => s.status);
  const definition = useDefinitionStore(s => s.definition);
  const error = useDefinitionStore(s => s.error);
  const requestDefinition = useDefinitionStore(s => s.requestDefinition);
  const clearDefinition = useDefinitionStore(s => s.clearDefinition);

  const onSelectFile = useCallback(async () => {
    try {
      const picked = await pickPdfFile();
      if (picked) {
        clearDefinition();
        setFile(picked);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Could not open file', message);
    }
  }, [clearDefinition, setFile]);

  const onClearFile = useCallback(() => {
    clearDefinition();
    clearFile();
  }, [clearDefinition, clearFile]);

  const onSelectTab = useCallback(
    (id: string) => {
      clearDefinition();
      selectTab(id);
    },
    [clearDefinition, selectTab],
  );

  const onCloseTab = useCallback(
    (id: string) => {
      clearDefinition();
      closeTab(id);
    },
    [clearDefinition, closeTab],
  );

  const onSaveFile = useCallback(
    async (name: string) => {
      if (!file || !name) {
        return;
      }
      try {
        const renamed = await renamePdfFile(file.uri, name);
        updateFile(renamed);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Alert.alert('Could not rename PDF', message);
      }
    },
    [file, updateFile],
  );

  const onWordClick = useCallback(
    (word: string) => {
      void requestDefinition(word);
    },
    [requestDefinition],
  );

  return (
    <ReaderShell
      fileName={file?.name}
      tabs={tabs}
      activeTabId={activeTabId}
      logoSource={require('./assets/kiteview-logo.png')}
      onSelectFile={onSelectFile}
      onSelectTab={onSelectTab}
      onCloseTab={onCloseTab}
      onClearFile={file ? onClearFile : undefined}
      onRenameFile={renameFile}
      onSaveFile={onSaveFile}
      leftGutter={
        <DefinitionPanel
          word={activeWord}
          status={status}
          definition={definition}
          error={error}
          onClose={clearDefinition}
        />
      }>
      {file ? (
        <PdfViewer
          sourceUri={file.uri}
          base64={file.base64}
          onWordClick={onWordClick}
          onError={message => Alert.alert('PDF error', message)}
        />
      ) : null}
    </ReaderShell>
  );
}

export default App;
