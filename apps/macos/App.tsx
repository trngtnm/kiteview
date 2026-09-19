/**
 * KiteView — macOS reader shell
 * @format
 */

import React, {useCallback} from 'react';
import {Alert} from 'react-native';
import {
  getEnv,
  pickPdfFile,
  renamePdfFile,
  useDefinitionStore,
  useDocumentStore,
  useParaphraseStore,
} from '@kiteview/core';
import {PdfViewer} from '@kiteview/pdf-engine';
import {DefinitionPanel, ParaphrasePanel, ReaderShell} from '@kiteview/ui';
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

  const activePhrase = useParaphraseStore(s => s.activePhrase);
  const paraphraseStatus = useParaphraseStore(s => s.status);
  const paraphraseAnnotation = useParaphraseStore(s => s.annotation);
  const paraphraseError = useParaphraseStore(s => s.error);
  const requestParaphrase = useParaphraseStore(s => s.requestParaphrase);
  const beginParaphrase = useParaphraseStore(s => s.beginParaphrase);
  const receiveParaphrase = useParaphraseStore(s => s.receiveParaphrase);
  const failParaphrase = useParaphraseStore(s => s.failParaphrase);
  const clearParaphrase = useParaphraseStore(s => s.clearParaphrase);

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
      clearParaphrase();
      void requestDefinition(word);
    },
    [clearParaphrase, requestDefinition],
  );

  const onPhraseSelect = useCallback(
    (phrase: string, pageNumber: number) => {
      clearDefinition();
      void requestParaphrase(phrase, pageNumber);
    },
    [clearDefinition, requestParaphrase],
  );

  const onPhraseAnnotation = useCallback(
    (phrase: string, content: string) => receiveParaphrase(phrase, content),
    [receiveParaphrase],
  );

  const onPhraseAnnotationError = useCallback(
    (phrase: string, message: string) => failParaphrase(phrase, message),
    [failParaphrase],
  );

  const env = getEnv();

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
        activePhrase ? (
          <ParaphrasePanel
            phrase={activePhrase}
            status={paraphraseStatus}
            annotation={paraphraseAnnotation}
            error={paraphraseError}
            onClose={clearParaphrase}
          />
        ) : (
          <DefinitionPanel
            word={activeWord}
            status={status}
            definition={definition}
            error={error}
            onClose={clearDefinition}
          />
        )
      }>
      {file ? (
        <PdfViewer
          sourceUri={file.uri}
          base64={file.base64}
          onWordClick={onWordClick}
          onPhraseSelect={onPhraseSelect}
          onPhraseAnnotation={onPhraseAnnotation}
          onPhraseAnnotationError={onPhraseAnnotationError}
          gptEndpointUrl={env.gptEndpointUrl}
          supabaseAnonKey={env.supabaseAnonKey}
          onError={message => Alert.alert('PDF error', message)}
        />
      ) : null}
    </ReaderShell>
  );
}

export default App;
