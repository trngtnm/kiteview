/**
 * KiteView — macOS reader shell
 * @format
 */

import React, {useCallback, useEffect, useRef} from 'react';
import {Alert, InteractionManager} from 'react-native';
import {
  pickPdfFile,
  renamePdfFile,
  useAnnotationStore,
  useDefinitionStore,
  useDocumentStore,
  useFormAnalysisStore,
} from '@kiteview/core';
import {
  PdfViewer,
  type DetectedFormField,
  type FormPageImagePayload,
  type PdfViewerHandle,
} from '@kiteview/pdf-engine';
import {
  AnnotationPanel,
  DefinitionPanel,
  FormFieldsPanel,
  ReaderShell,
} from '@kiteview/ui';
import {bootstrapEnv} from './src/bootstrapEnv';
import {registerMacosPdfPicker} from './src/registerMacosPdfPicker';

bootstrapEnv();
registerMacosPdfPicker();

function App() {
  const pdfRef = useRef<PdfViewerHandle>(null);
  const page1ReadyRef = useRef(false);
  const heuristicStartedRef = useRef(false);
  const visionStartedRef = useRef(false);

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

  const activePhrase = useAnnotationStore(s => s.activePhrase);
  const annotationMode = useAnnotationStore(s => s.mode);
  const annotationStatus = useAnnotationStore(s => s.status);
  const annotation = useAnnotationStore(s => s.annotation);
  const annotationError = useAnnotationStore(s => s.error);
  const requestAnnotation = useAnnotationStore(s => s.requestAnnotation);
  const setAnnotationMode = useAnnotationStore(s => s.setMode);
  const clearAnnotation = useAnnotationStore(s => s.clearAnnotation);
  const formStatus = useFormAnalysisStore(s => s.status);
  const formFields = useFormAnalysisStore(s => s.fields);
  const selectedFieldId = useFormAnalysisStore(s => s.selectedFieldId);
  const formError = useFormAnalysisStore(s => s.error);
  const cascadeStage = useFormAnalysisStore(s => s.cascadeStage);
  const startDetect = useFormAnalysisStore(s => s.startDetect);
  const applyHeuristicFields = useFormAnalysisStore(s => s.applyHeuristicFields);
  const applyVisionFromPages = useFormAnalysisStore(s => s.applyVisionFromPages);
  const selectFormField = useFormAnalysisStore(s => s.selectField);
  const setFieldValue = useFormAnalysisStore(s => s.setFieldValue);
  const clearFormAnalysis = useFormAnalysisStore(s => s.clear);

  const cascadeBusy =
    cascadeStage === 'acroform' ||
    cascadeStage === 'heuristic' ||
    cascadeStage === 'vision';

  const tryHeuristic = useCallback(() => {
    if (cascadeStage !== 'heuristic') return;
    if (!page1ReadyRef.current || heuristicStartedRef.current) return;
    heuristicStartedRef.current = true;
    pdfRef.current?.runHeuristicDetect();
  }, [cascadeStage]);

  const tryVision = useCallback(() => {
    if (cascadeStage !== 'vision') return;
    if (!page1ReadyRef.current || visionStartedRef.current) return;
    visionStartedRef.current = true;
    // Sparse fallback only — page 1 for speed.
    pdfRef.current?.capturePagesForDetect(1);
  }, [cascadeStage]);

  useEffect(() => {
    tryHeuristic();
  }, [tryHeuristic]);

  useEffect(() => {
    tryVision();
  }, [tryVision]);

  const onSelectFile = useCallback(async () => {
    try {
      const picked = await pickPdfFile();
      if (picked) {
        page1ReadyRef.current = false;
        heuristicStartedRef.current = false;
        visionStartedRef.current = false;
        clearDefinition();
        clearAnnotation();
        clearFormAnalysis();
        setFile(picked);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Could not open file', message);
    }
  }, [clearAnnotation, clearDefinition, clearFormAnalysis, setFile]);

  const onClearFile = useCallback(() => {
    page1ReadyRef.current = false;
    heuristicStartedRef.current = false;
    visionStartedRef.current = false;
    clearDefinition();
    clearAnnotation();
    clearFormAnalysis();
    clearFile();
  }, [clearAnnotation, clearDefinition, clearFormAnalysis, clearFile]);

  const onDetectForms = useCallback(() => {
    if (!file?.base64) {
      Alert.alert(
        'Cannot detect forms',
        'Re-open the PDF so form data can be analyzed.',
      );
      return;
    }
    heuristicStartedRef.current = false;
    visionStartedRef.current = false;
    InteractionManager.runAfterInteractions(() => {
      void startDetect(file.base64!);
    });
  }, [file, startDetect]);

  const onSelectTab = useCallback(
    (id: string) => {
      clearDefinition();
      clearAnnotation();
      selectTab(id);
    },
    [clearAnnotation, clearDefinition, selectTab],
  );

  const onCloseTab = useCallback(
    (id: string) => {
      clearDefinition();
      clearAnnotation();
      closeTab(id);
    },
    [clearAnnotation, clearDefinition, closeTab],
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
      clearAnnotation();
      void requestDefinition(word);
    },
    [clearAnnotation, requestDefinition],
  );

  const onPhraseSelect = useCallback(
    (phrase: string, pageNumber: number, context?: string) => {
      clearDefinition();
      void requestAnnotation(phrase, pageNumber, undefined, context);
    },
    [clearDefinition, requestAnnotation],
  );

  const onPageReady = useCallback(
    (pageNumber: number) => {
      if (pageNumber === 1) {
        page1ReadyRef.current = true;
        tryHeuristic();
        tryVision();
      }
    },
    [tryHeuristic, tryVision],
  );

  const onHeuristicFields = useCallback(
    (fields: DetectedFormField[]) => {
      if (useFormAnalysisStore.getState().cascadeStage !== 'heuristic') {
        return;
      }
      applyHeuristicFields(fields);
    },
    [applyHeuristicFields],
  );

  const onFormPageImages = useCallback(
    (pages: FormPageImagePayload[]) => {
      if (useFormAnalysisStore.getState().cascadeStage !== 'vision') {
        return;
      }
      if (pages.length === 0) {
        const prior = useFormAnalysisStore.getState().fields;
        if (prior.length === 0) {
          useFormAnalysisStore.getState().markNone();
        } else {
          useFormAnalysisStore.setState({cascadeStage: 'done'});
        }
        return;
      }
      void applyVisionFromPages(pages);
    },
    [applyVisionFromPages],
  );

  const formsDetectLabel = cascadeBusy
    ? cascadeStage === 'vision'
      ? formFields.length > 0
        ? 'Refining…'
        : 'Scanning page…'
      : cascadeStage === 'heuristic'
        ? formFields.length > 0
          ? 'Checking layout…'
          : 'Checking layout…'
        : 'Detecting…'
    : formStatus === 'ready'
      ? 'Re-detect forms'
      : formStatus === 'none'
        ? 'Scan again'
        : 'Detect forms';

  const showFormOverlays = formFields.length > 0;

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
      onDetectForms={file ? onDetectForms : undefined}
      formsDetectLabel={formsDetectLabel}
      formsDetectDisabled={cascadeBusy}
      formFieldCount={showFormOverlays ? formFields.length : undefined}
      onRenameFile={renameFile}
      onSaveFile={onSaveFile}
      leftGutter={
        activePhrase ? (
          <AnnotationPanel
            phrase={activePhrase}
            mode={annotationMode}
            status={annotationStatus}
            annotation={annotation}
            error={annotationError}
            onModeChange={setAnnotationMode}
            onClose={clearAnnotation}
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
      }
      rightGutter={
        file && formStatus !== 'idle' ? (
          <FormFieldsPanel
            status={formStatus}
            fields={formFields}
            selectedFieldId={selectedFieldId}
            error={formError}
            onSelectField={selectFormField}
          />
        ) : null
      }>
      {file ? (
        <PdfViewer
          viewerRef={pdfRef}
          sourceUri={file.uri}
          base64={file.base64}
          formFields={showFormOverlays ? formFields : undefined}
          selectedFieldId={selectedFieldId}
          onWordClick={onWordClick}
          onPhraseSelect={onPhraseSelect}
          onPageReady={onPageReady}
          onFormFieldClick={selectFormField}
          onFormFieldChange={setFieldValue}
          onHeuristicFields={onHeuristicFields}
          onFormPageImages={onFormPageImages}
          onError={message => Alert.alert('PDF error', message)}
        />
      ) : null}
    </ReaderShell>
  );
}

export default App;
