/**
 * KiteView — macOS reader shell
 * @format
 */

import React, {useCallback, useEffect, useRef} from 'react';
import {Alert, ScrollView} from 'react-native';
import {
  pickPdfFile,
  preloadFormAnalysis,
  renamePdfFile,
  useAnnotationStore,
  useDefinitionStore,
  useDocumentStore,
  useFormAnalysisStore,
  usePinnedAnnotationStore,
  type RectNorm,
} from '@kiteview/core';
import {
  PdfViewer,
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
  const annotationRect = useAnnotationStore(s => s.rectNorm);
  const viewingPinnedId = useAnnotationStore(s => s.viewingPinnedId);
  const requestAnnotation = useAnnotationStore(s => s.requestAnnotation);
  const showPinnedAnnotation = useAnnotationStore(s => s.showPinnedAnnotation);
  const setAnnotationMode = useAnnotationStore(s => s.setMode);
  const clearAnnotation = useAnnotationStore(s => s.clearAnnotation);

  const pinnedPins = usePinnedAnnotationStore(s => s.pins);
  const selectedPinnedId = usePinnedAnnotationStore(s => s.selectedId);
  const loadPinnedForDocument = usePinnedAnnotationStore(s => s.loadForDocument);
  const pinAnnotation = usePinnedAnnotationStore(s => s.pinAnnotation);
  const unpinAnnotation = usePinnedAnnotationStore(s => s.unpinAnnotation);
  const selectPinned = usePinnedAnnotationStore(s => s.selectPinned);
  const clearPinnedActive = usePinnedAnnotationStore(s => s.clearActive);
  const clearPinnedDocument = usePinnedAnnotationStore(s => s.clearDocument);

  const formStatus = useFormAnalysisStore(s => s.status);
  const formFields = useFormAnalysisStore(s => s.fields);
  const selectedFieldId = useFormAnalysisStore(s => s.selectedFieldId);
  const formError = useFormAnalysisStore(s => s.error);
  const cascadeStage = useFormAnalysisStore(s => s.cascadeStage);
  const startDetect = useFormAnalysisStore(s => s.startDetect);
  const applyVisionFromPages = useFormAnalysisStore(s => s.applyVisionFromPages);
  const selectFormField = useFormAnalysisStore(s => s.selectField);
  const setFieldValue = useFormAnalysisStore(s => s.setFieldValue);
  const clearFormAnalysis = useFormAnalysisStore(s => s.clear);

  const documentKey = file?.uri ?? null;

  useEffect(() => {
    preloadFormAnalysis();
  }, []);

  useEffect(() => {
    if (!documentKey) {
      clearPinnedDocument();
      return;
    }
    preloadFormAnalysis();
    void loadPinnedForDocument(documentKey);
  }, [documentKey, loadPinnedForDocument, clearPinnedDocument]);

  const cascadeBusy =
    cascadeStage === 'acroform' || cascadeStage === 'vision';

  const tryVision = useCallback(() => {
    if (cascadeStage !== 'vision') return;
    if (!page1ReadyRef.current || visionStartedRef.current) return;
    visionStartedRef.current = true;
    pdfRef.current?.capturePagesForDetect(1);
  }, [cascadeStage]);

  useEffect(() => {
    tryVision();
  }, [tryVision]);

  const resetPanels = useCallback(() => {
    clearDefinition();
    clearAnnotation();
    clearPinnedActive();
  }, [clearAnnotation, clearDefinition, clearPinnedActive]);

  const onSelectFile = useCallback(async () => {
    try {
      const picked = await pickPdfFile();
      if (picked) {
        page1ReadyRef.current = false;
        visionStartedRef.current = false;
        resetPanels();
        clearFormAnalysis();
        setFile(picked);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Could not open file', message);
    }
  }, [clearFormAnalysis, resetPanels, setFile]);

  const onClearFile = useCallback(() => {
    page1ReadyRef.current = false;
    visionStartedRef.current = false;
    resetPanels();
    clearFormAnalysis();
    clearPinnedDocument();
    clearFile();
  }, [
    clearFile,
    clearFormAnalysis,
    clearPinnedDocument,
    resetPanels,
  ]);

  const onAiScanForms = useCallback(() => {
    if (!file?.base64) {
      Alert.alert(
        'Cannot scan forms',
        'Re-open the PDF so form data can be analyzed.',
      );
      return;
    }
    visionStartedRef.current = false;
    void startDetect(file.base64);
  }, [file, startDetect]);

  const onSelectTab = useCallback(
    (id: string) => {
      resetPanels();
      selectTab(id);
    },
    [resetPanels, selectTab],
  );

  const onCloseTab = useCallback(
    (id: string) => {
      resetPanels();
      closeTab(id);
    },
    [closeTab, resetPanels],
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

  const onPhraseSelect = useCallback(
    (
      phrase: string,
      pageNumber: number,
      context?: string,
      rectNorm?: RectNorm,
    ) => {
      clearPinnedActive();
      void requestAnnotation(
        phrase,
        pageNumber,
        undefined,
        context,
        rectNorm,
      );
    },
    [clearPinnedActive, requestAnnotation],
  );

  const onPinnedAnnotationClick = useCallback(
    (id: string) => {
      const pin = usePinnedAnnotationStore
        .getState()
        .pins.find(p => p.id === id);
      if (!pin) return;
      selectPinned(id);
      showPinnedAnnotation(pin);
    },
    [selectPinned, showPinnedAnnotation],
  );

  const onPin = useCallback(async () => {
    if (!file?.uri || !annotation || !annotationRect || !activePhrase) {
      Alert.alert(
        'Cannot pin',
        'Select the phrase again so its position on the page is known.',
      );
      return;
    }
    const pageNumber = useAnnotationStore.getState().pageNumber ?? 1;
    const pin = await pinAnnotation({
      documentKey: file.uri,
      phrase: activePhrase,
      content: annotation.content,
      mode: annotationMode,
      pageNumber,
      rectNorm: annotationRect,
    });
    if (pin) {
      showPinnedAnnotation(pin);
    } else {
      Alert.alert('Could not pin', 'The annotation could not be saved. Try selecting the phrase again.');
    }
  }, [
    activePhrase,
    annotation,
    annotationMode,
    annotationRect,
    file?.uri,
    pinAnnotation,
    showPinnedAnnotation,
  ]);

  const onUnpin = useCallback(async () => {
    if (!viewingPinnedId) return;
    await unpinAnnotation(viewingPinnedId);
    clearAnnotation();
  }, [clearAnnotation, unpinAnnotation, viewingPinnedId]);

  const onCloseAnnotation = useCallback(() => {
    clearAnnotation();
    clearPinnedActive();
  }, [clearAnnotation, clearPinnedActive]);

  const onPageReady = useCallback(
    (pageNumber: number) => {
      if (pageNumber === 1) {
        page1ReadyRef.current = true;
        tryVision();
      }
    },
    [tryVision],
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
      ? 'Scanning page…'
      : 'Detecting…'
    : formStatus === 'ready' || formStatus === 'none'
      ? 'AI scan again'
      : 'AI scan';

  const showFormOverlays = formFields.length > 0;
  const canPin = Boolean(
    annotationStatus === 'ready' &&
      annotation &&
      annotationRect &&
      !viewingPinnedId,
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
      onDetectForms={file ? onAiScanForms : undefined}
      formsDetectLabel={formsDetectLabel}
      formsDetectDisabled={cascadeBusy}
      formFieldCount={showFormOverlays ? formFields.length : undefined}
      onRenameFile={renameFile}
      onSaveFile={onSaveFile}
      leftGutter={
        <ScrollView
          style={{flex: 1}}
          contentContainerStyle={{paddingBottom: 24}}
          showsVerticalScrollIndicator={false}>
          <DefinitionPanel
            word={activeWord}
            status={status}
            definition={definition}
            error={error}
            onClose={clearDefinition}
          />
          <AnnotationPanel
            phrase={activePhrase}
            mode={annotationMode}
            status={annotationStatus}
            annotation={annotation}
            error={annotationError}
            pinned={Boolean(viewingPinnedId)}
            canPin={canPin}
            onModeChange={setAnnotationMode}
            onPin={() => {
              void onPin();
            }}
            onUnpin={() => {
              void onUnpin();
            }}
            onClose={onCloseAnnotation}
          />
        </ScrollView>
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
          pinnedAnnotations={pinnedPins}
          selectedPinnedId={selectedPinnedId ?? viewingPinnedId}
          onWordClick={onWordClick}
          onPhraseSelect={onPhraseSelect}
          onPinnedAnnotationClick={onPinnedAnnotationClick}
          onPageReady={onPageReady}
          onFormFieldClick={selectFormField}
          onFormFieldChange={setFieldValue}
          onFormPageImages={onFormPageImages}
          onError={message => Alert.alert('PDF error', message)}
        />
      ) : null}
    </ReaderShell>
  );
}

export default App;
