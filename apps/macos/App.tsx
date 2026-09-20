/**
 * KiteView — macOS reader shell
 * @format
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, ScrollView} from 'react-native';
import {
  pickPdfFile,
  preloadFormAnalysis,
  renamePdfFile,
  savePdfBytes,
  useAnnotationStore,
  useAppearanceStore,
  useAuthStore,
  useDefinitionStore,
  useDocumentStore,
  useFormAnalysisStore,
  usePinnedAnnotationStore,
  usePreferencesStore,
  chooseMarginSide,
  type RectNorm,
} from '@kiteview/core';
import {
  PdfViewer,
  type DetectedFormField,
  type FormPageImagePayload,
  type PdfViewerHandle,
} from '@kiteview/pdf-engine';
import {
  AnnotationPanel,
  AuthPanel,
  DefinitionPanel,
  FormFieldsPanel,
  PreferencesPanel,
  ProfilePanel,
  ReaderShell,
  ThemeProvider,
} from '@kiteview/ui';
import {bootstrapEnv} from './src/bootstrapEnv';
import {registerMacosPdfPicker} from './src/registerMacosPdfPicker';

bootstrapEnv();
registerMacosPdfPicker();

/** Manual Find form fields / overlays / FormFieldsPanel. */
const FORMS_ENABLED = true;

type AccountPanel = 'none' | 'auth' | 'profile' | 'preferences';

function App() {
  const pdfRef = useRef<PdfViewerHandle>(null);
  const page1ReadyRef = useRef(false);
  const acroformStartedRef = useRef(false);
  const heuristicStartedRef = useRef(false);
  const visionStartedRef = useRef(false);
  const [accountPanel, setAccountPanel] = useState<AccountPanel>('none');
  const [authInfo, setAuthInfo] = useState<string | null>(null);

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
  const annotationPageNumber = useAnnotationStore(s => s.pageNumber);
  const annotationMode = useAnnotationStore(s => s.mode);
  const annotationStatus = useAnnotationStore(s => s.status);
  const annotation = useAnnotationStore(s => s.annotation);
  const annotationError = useAnnotationStore(s => s.error);
  const annotationRect = useAnnotationStore(s => s.rectNorm);
  const userComment = useAnnotationStore(s => s.userComment);
  const viewingPinnedId = useAnnotationStore(s => s.viewingPinnedId);
  const requestAnnotation = useAnnotationStore(s => s.requestAnnotation);
  const showPinnedAnnotation = useAnnotationStore(s => s.showPinnedAnnotation);
  const setAnnotationMode = useAnnotationStore(s => s.setMode);
  const setUserComment = useAnnotationStore(s => s.setUserComment);
  const clearAnnotation = useAnnotationStore(s => s.clearAnnotation);
  const clearViewingPin = useAnnotationStore(s => s.clearViewingPin);

  const pinnedPins = usePinnedAnnotationStore(s => s.pins);
  const selectedPinnedId = usePinnedAnnotationStore(s => s.selectedId);
  const loadPinnedForDocument = usePinnedAnnotationStore(s => s.loadForDocument);
  const pinAnnotation = usePinnedAnnotationStore(s => s.pinAnnotation);
  const updatePinComment = usePinnedAnnotationStore(s => s.updatePinComment);
  const unpinAnnotation = usePinnedAnnotationStore(s => s.unpinAnnotation);
  const selectPinned = usePinnedAnnotationStore(s => s.selectPinned);
  const clearPinnedActive = usePinnedAnnotationStore(s => s.clearActive);
  const clearPinnedDocument = usePinnedAnnotationStore(s => s.clearDocument);

  const formStatus = useFormAnalysisStore(s => s.status);
  const formFields = useFormAnalysisStore(s => s.fields);
  const fieldValues = useFormAnalysisStore(s => s.fieldValues);
  const selectedFieldId = useFormAnalysisStore(s => s.selectedFieldId);
  const formError = useFormAnalysisStore(s => s.error);
  const cascadeStage = useFormAnalysisStore(s => s.cascadeStage);
  const webviewAcroPending = useFormAnalysisStore(s => s.webviewAcroPending);
  const fallbacksSuppressed = useFormAnalysisStore(s => s.fallbacksSuppressed);
  const startDetect = useFormAnalysisStore(s => s.startDetect);
  const applyAcroformFields = useFormAnalysisStore(s => s.applyAcroformFields);
  const applyHeuristicFields = useFormAnalysisStore(s => s.applyHeuristicFields);
  const applyVisionFromPages = useFormAnalysisStore(s => s.applyVisionFromPages);
  const selectFormField = useFormAnalysisStore(s => s.selectField);
  const setFieldValue = useFormAnalysisStore(s => s.setFieldValue);
  const clearFormAnalysis = useFormAnalysisStore(s => s.clear);
  const [downloadBusy, setDownloadBusy] = useState(false);

  const authUser = useAuthStore(s => s.user);
  const authPending = useAuthStore(s => s.pending);
  const authError = useAuthStore(s => s.error);
  const bootstrapAuth = useAuthStore(s => s.bootstrap);
  const signIn = useAuthStore(s => s.signIn);
  const signUp = useAuthStore(s => s.signUp);
  const signOut = useAuthStore(s => s.signOut);
  const clearAuthError = useAuthStore(s => s.clearError);

  const preferences = usePreferencesStore(s => s.preferences);
  const preferencesStatus = usePreferencesStore(s => s.status);
  const preferencesError = usePreferencesStore(s => s.error);
  const preferencesDirty = usePreferencesStore(s => s.dirty);
  const loadPreferences = usePreferencesStore(s => s.loadPreferences);
  const setLocalPreferences = usePreferencesStore(s => s.setLocal);
  const toggleDomainTag = usePreferencesStore(s => s.toggleDomainTag);
  const savePreferences = usePreferencesStore(s => s.savePreferences);
  const resetPreferences = usePreferencesStore(s => s.resetToDefaults);

  const appearanceMode = useAppearanceStore(s => s.mode);
  const hydrateAppearance = useAppearanceStore(s => s.hydrate);
  const toggleAppearance = useAppearanceStore(s => s.toggleMode);

  const documentKey = file?.uri ?? null;

  useEffect(() => {
    void bootstrapAuth();
  }, [bootstrapAuth]);

  useEffect(() => {
    void hydrateAppearance();
  }, [hydrateAppearance]);

  useEffect(() => {
    if (authUser?.id) {
      void loadPreferences(authUser.id);
    } else {
      resetPreferences();
    }
  }, [authUser?.id, loadPreferences, resetPreferences]);

  useEffect(() => {
    if (!FORMS_ENABLED) return;
    preloadFormAnalysis();
  }, []);

  useEffect(() => {
    // Form overlays/panel are per-document; clear on every PDF/tab switch.
    clearFormAnalysis();
    page1ReadyRef.current = false;
    acroformStartedRef.current = false;
    heuristicStartedRef.current = false;
    visionStartedRef.current = false;

    if (!documentKey) {
      clearPinnedDocument();
      return;
    }
    if (FORMS_ENABLED) {
      preloadFormAnalysis();
    }
    void loadPinnedForDocument(documentKey);
  }, [
    documentKey,
    loadPinnedForDocument,
    clearPinnedDocument,
    clearFormAnalysis,
  ]);

  const cascadeBusy =
    FORMS_ENABLED &&
    (cascadeStage === 'scanning' ||
      cascadeStage === 'acroform' ||
      cascadeStage === 'heuristic' ||
      cascadeStage === 'vision');

  const tryAcroform = useCallback(() => {
    if (!FORMS_ENABLED) return;
    if (cascadeStage !== 'scanning' && cascadeStage !== 'acroform') return;
    if (!page1ReadyRef.current || acroformStartedRef.current) return;
    acroformStartedRef.current = true;
    pdfRef.current?.runAcroformDetect();
  }, [cascadeStage]);

  const tryHeuristic = useCallback(() => {
    if (!FORMS_ENABLED) return;
    if (cascadeStage !== 'scanning' && cascadeStage !== 'heuristic') return;
    if (webviewAcroPending || fallbacksSuppressed) return;
    if (!page1ReadyRef.current || heuristicStartedRef.current) return;
    heuristicStartedRef.current = true;
    pdfRef.current?.runHeuristicDetect();
  }, [cascadeStage, webviewAcroPending, fallbacksSuppressed]);

  const tryVision = useCallback(() => {
    if (!FORMS_ENABLED) return;
    if (cascadeStage !== 'scanning' && cascadeStage !== 'vision') return;
    if (webviewAcroPending || fallbacksSuppressed) return;
    if (!useFormAnalysisStore.getState().visionPending) return;
    if (!page1ReadyRef.current || visionStartedRef.current) return;
    visionStartedRef.current = true;
    pdfRef.current?.capturePagesForDetect(1);
  }, [cascadeStage, webviewAcroPending, fallbacksSuppressed]);

  useEffect(() => {
    tryAcroform();
  }, [tryAcroform]);

  useEffect(() => {
    tryHeuristic();
  }, [tryHeuristic]);

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
        acroformStartedRef.current = false;
        heuristicStartedRef.current = false;
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
    acroformStartedRef.current = false;
    heuristicStartedRef.current = false;
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
    if (!FORMS_ENABLED) return;
    if (!file?.base64) {
      Alert.alert(
        'Cannot find form fields',
        'Re-open the PDF so form data can be analyzed.',
      );
      return;
    }
    acroformStartedRef.current = false;
    heuristicStartedRef.current = false;
    visionStartedRef.current = false;
    void startDetect(file.base64);
    // Kick WebView AcroForm immediately if page 1 is already ready.
    if (page1ReadyRef.current) {
      acroformStartedRef.current = true;
      pdfRef.current?.runAcroformDetect();
    }
  }, [file, startDetect]);

  const onDownloadFilledPdf = useCallback(async () => {
    if (!FORMS_ENABLED || !file) return;
    const hasValues = Object.values(fieldValues).some(v => String(v).trim());
    if (!hasValues) {
      Alert.alert(
        'Nothing to download',
        'Type into at least one form field before downloading.',
      );
      return;
    }
    if (formFields.length === 0) {
      Alert.alert(
        'No form fields',
        'Find form fields first, then fill them in.',
      );
      return;
    }
    setDownloadBusy(true);
    try {
      const pages = await pdfRef.current?.exportFilledPages(fieldValues);
      if (!pages || pages.length === 0) {
        throw new Error('Could not capture filled pages');
      }
      const {exportFilledPdfFromPageImages} = await import(
        '@kiteview/pdf-engine/src/exportFilledPdf'
      );
      const {base64} = await exportFilledPdfFromPageImages(pages);
      const baseName = (file.name || 'document').replace(/\.pdf$/i, '');
      const saved = await savePdfBytes(base64, `${baseName}-filled.pdf`);
      if (saved) {
        Alert.alert('Saved', `Filled PDF saved as ${saved.name}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Download failed', message);
    } finally {
      setDownloadBusy(false);
    }
  }, [file, fieldValues, formFields.length]);

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

  const commentSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pendingCommentRef = useRef<{pinId: string; comment: string} | null>(
    null,
  );

  const flushPendingComment = useCallback(() => {
    if (commentSaveTimerRef.current) {
      clearTimeout(commentSaveTimerRef.current);
      commentSaveTimerRef.current = null;
    }
    const pending = pendingCommentRef.current;
    if (!pending) return;
    pendingCommentRef.current = null;
    void updatePinComment(pending.pinId, pending.comment);
  }, [updatePinComment]);

  const onUserCommentChange = useCallback(
    (comment: string) => {
      setUserComment(comment);
      const pinId = useAnnotationStore.getState().viewingPinnedId;
      if (!pinId) return;
      pendingCommentRef.current = {pinId, comment};
      if (commentSaveTimerRef.current) {
        clearTimeout(commentSaveTimerRef.current);
      }
      commentSaveTimerRef.current = setTimeout(() => {
        commentSaveTimerRef.current = null;
        const pending = pendingCommentRef.current;
        pendingCommentRef.current = null;
        if (pending) {
          void updatePinComment(pending.pinId, pending.comment);
        }
      }, 350);
    },
    [setUserComment, updatePinComment],
  );

  useEffect(() => {
    return () => {
      flushPendingComment();
    };
  }, [flushPendingComment]);

  const onPhraseSelect = useCallback(
    (
      phrase: string,
      pageNumber: number,
      context?: string,
      rectNorm?: RectNorm,
    ) => {
      flushPendingComment();
      clearPinnedActive();
      void requestAnnotation(
        phrase,
        pageNumber,
        undefined,
        context,
        rectNorm,
      );
    },
    [clearPinnedActive, flushPendingComment, requestAnnotation],
  );

  const onPinnedAnnotationClick = useCallback(
    (
      id: string,
      source: 'highlight' | 'note' = 'highlight',
      action: 'expand' | 'open' = 'open',
    ) => {
      flushPendingComment();
      const pin = usePinnedAnnotationStore
        .getState()
        .pins.find(p => p.id === id);
      if (!pin) return;

      const viewingId = useAnnotationStore.getState().viewingPinnedId;
      const selectedId = usePinnedAnnotationStore.getState().selectedId;

      if (source === 'note' && action === 'expand') {
        // Left click: little note only.
        if (viewingId === id) {
          // Large is open → close it, keep little expanded.
          clearAnnotation();
          selectPinned(id);
          return;
        }
        if (selectedId === id) {
          // Already expanded → collapse.
          clearPinnedActive();
          return;
        }
        clearAnnotation();
        selectPinned(id);
        return;
      }

      // Right-click note or highlight click: expand + open large panel.
      if (viewingId === id) {
        clearAnnotation();
        clearPinnedActive();
        return;
      }
      selectPinned(id);
      showPinnedAnnotation(pin);
    },
    [
      clearAnnotation,
      clearPinnedActive,
      flushPendingComment,
      selectPinned,
      showPinnedAnnotation,
    ],
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
      userComment: useAnnotationStore.getState().userComment,
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
    flushPendingComment();
    if (!viewingPinnedId) return;
    await unpinAnnotation(viewingPinnedId);
    clearPinnedActive();
    // Keep the big panel open; just leave the unpinned state.
    clearViewingPin();
  }, [
    clearPinnedActive,
    clearViewingPin,
    flushPendingComment,
    unpinAnnotation,
    viewingPinnedId,
  ]);

  const onCloseAnnotation = useCallback(() => {
    flushPendingComment();
    clearAnnotation();
    clearPinnedActive();
  }, [clearAnnotation, clearPinnedActive, flushPendingComment]);

  const onPageReady = useCallback(
    (pageNumber: number) => {
      if (pageNumber === 1) {
        page1ReadyRef.current = true;
        tryAcroform();
        tryHeuristic();
        tryVision();
      }
    },
    [tryAcroform, tryHeuristic, tryVision],
  );

  const onAcroformFields = useCallback(
    (fields: DetectedFormField[]) => {
      const stage = useFormAnalysisStore.getState().cascadeStage;
      if (stage !== 'scanning' && stage !== 'acroform') {
        return;
      }
      applyAcroformFields(fields);
      // If no widgets, allow heuristic/vision kickoff now.
      if (fields.length === 0) {
        tryHeuristic();
        tryVision();
      }
    },
    [applyAcroformFields, tryHeuristic, tryVision],
  );

  const onHeuristicFields = useCallback(
    (fields: DetectedFormField[]) => {
      const stage = useFormAnalysisStore.getState().cascadeStage;
      if (stage !== 'scanning' && stage !== 'heuristic') {
        return;
      }
      applyHeuristicFields(fields);
    },
    [applyHeuristicFields],
  );

  const onFormPageImages = useCallback(
    (pages: FormPageImagePayload[]) => {
      const stage = useFormAnalysisStore.getState().cascadeStage;
      if (stage !== 'scanning' && stage !== 'vision') {
        return;
      }
      if (pages.length === 0) {
        void applyVisionFromPages([]);
        return;
      }
      void applyVisionFromPages(pages);
    },
    [applyVisionFromPages],
  );

  const formsDetectLabel = cascadeBusy
    ? 'Finding…'
    : 'Find form fields';

  const showFormOverlays = FORMS_ENABLED && formFields.length > 0;
  const canPin = Boolean(
    annotationStatus === 'ready' &&
      annotation &&
      annotationRect &&
      !viewingPinnedId,
  );

  const smallNoteSide: 'left' | 'right' = (() => {
    if (viewingPinnedId) {
      const pin = pinnedPins.find(p => p.id === viewingPinnedId);
      if (pin?.side === 'left' || pin?.side === 'right') return pin.side;
    }
    if (annotationRect) return chooseMarginSide(annotationRect);
    return 'right';
  })();
  // Large gutter panel sits opposite the little margin note.
  const largeAnnotationSide: 'left' | 'right' =
    smallNoteSide === 'left' ? 'right' : 'left';

  const activeMarginAnnotation =
    activePhrase &&
    annotationRect &&
    annotationPageNumber &&
    annotationStatus !== 'idle'
      ? {
          phrase: activePhrase,
          content: annotation?.content ?? '',
          status: annotationStatus as 'loading' | 'ready' | 'error',
          error: annotationError,
          pageNumber: annotationPageNumber,
          rectNorm: annotationRect,
          side: smallNoteSide,
          pinId: viewingPinnedId,
          userComment,
        }
      : null;

  const annotationPanel = (
    <AnnotationPanel
      phrase={activePhrase}
      mode={annotationMode}
      status={annotationStatus}
      annotation={annotation}
      error={annotationError}
      pageNumber={annotationPageNumber}
      userComment={userComment}
      pinned={Boolean(viewingPinnedId)}
      canPin={canPin}
      onModeChange={setAnnotationMode}
      onUserCommentChange={onUserCommentChange}
      onPin={() => {
        void onPin();
      }}
      onUnpin={() => {
        void onUnpin();
      }}
      onClose={onCloseAnnotation}
    />
  );

  const signedIn = Boolean(authUser);
  const accountLabel = authUser?.email?.trim() || 'Guest';

  const onSignIn = useCallback(
    async (email: string, password: string) => {
      setAuthInfo(null);
      clearAuthError();
      const ok = await signIn(email, password);
      if (ok) {
        setAccountPanel('profile');
      }
    },
    [clearAuthError, signIn],
  );

  const onSignUp = useCallback(
    async (email: string, password: string) => {
      setAuthInfo(null);
      clearAuthError();
      const ok = await signUp(email, password);
      if (ok) {
        setAccountPanel('profile');
      } else {
        const message = useAuthStore.getState().error;
        if (message?.toLowerCase().includes('check your email')) {
          setAuthInfo(message);
        }
      }
    },
    [clearAuthError, signUp],
  );

  const onSignOut = useCallback(async () => {
    await signOut();
    resetPreferences();
    setAccountPanel('none');
    setAuthInfo(null);
  }, [resetPreferences, signOut]);

  const onSavePreferences = useCallback(async () => {
    if (!authUser?.id) return;
    const ok = await savePreferences(authUser.id);
    if (ok) {
      Alert.alert('Preferences saved', 'New annotations will use these settings.');
    }
  }, [authUser?.id, savePreferences]);

  return (
    <ThemeProvider scheme={appearanceMode}>
    <ReaderShell
      fileName={file?.name}
      tabs={tabs}
      activeTabId={activeTabId}
      logoSource={require('./assets/kiteview-logo.png')}
      onSelectFile={onSelectFile}
      onSelectTab={onSelectTab}
      onCloseTab={onCloseTab}
      onClearFile={file ? onClearFile : undefined}
      onDetectForms={FORMS_ENABLED && file ? onAiScanForms : undefined}
      formsDetectLabel={formsDetectLabel}
      formsDetectDisabled={cascadeBusy}
      formFieldCount={showFormOverlays ? formFields.length : undefined}
      // TEMP: hide Download PDF until export flow is ready to ship again.
      onDownloadFilledPdf={undefined}
      downloadFilledDisabled={downloadBusy || cascadeBusy}
      downloadFilledLabel={downloadBusy ? 'Downloading…' : 'Download PDF'}
      onRenameFile={renameFile}
      onSaveFile={onSaveFile}
      accountLabel={accountLabel}
      colorScheme={appearanceMode}
      onToggleAppearance={toggleAppearance}
      onOpenAccount={() => {
        clearAuthError();
        setAuthInfo(null);
        setAccountPanel('profile');
      }}
      onOpenPreferences={() => {
        clearAuthError();
        setAuthInfo(null);
        setAccountPanel('preferences');
      }}
      onSignOut={signedIn ? () => { void onSignOut(); } : undefined}
      accountPanel={
        accountPanel === 'auth' ? (
          <AuthPanel
            busy={authPending}
            error={authError}
            info={authInfo}
            onSignIn={(email, password) => {
              void onSignIn(email, password);
            }}
            onSignUp={(email, password) => {
              void onSignUp(email, password);
            }}
            onClose={() => setAccountPanel('none')}
          />
        ) : accountPanel === 'profile' ? (
          <ProfilePanel
            email={authUser?.email}
            signedIn={signedIn}
            onSignOut={
              signedIn
                ? () => {
                    void onSignOut();
                  }
                : undefined
            }
            onOpenAuth={() => setAccountPanel('auth')}
            onOpenPreferences={() => setAccountPanel('preferences')}
            onClose={() => setAccountPanel('none')}
          />
        ) : accountPanel === 'preferences' ? (
          <PreferencesPanel
            preferences={preferences}
            signedIn={signedIn}
            busy={
              preferencesStatus === 'saving' || preferencesStatus === 'loading'
            }
            dirty={preferencesDirty}
            error={preferencesError}
            onChange={setLocalPreferences}
            onToggleDomain={toggleDomainTag}
            onSave={() => {
              void onSavePreferences();
            }}
            onClose={() => setAccountPanel('none')}
            onOpenAuth={() => setAccountPanel('auth')}
          />
        ) : null
      }
      leftGutter={
        <ScrollView
          style={{flex: 1, backgroundColor: 'transparent'}}
          contentContainerStyle={{paddingBottom: 24}}
          showsVerticalScrollIndicator={false}>
          <DefinitionPanel
            word={activeWord}
            status={status}
            definition={definition}
            error={error}
            onClose={clearDefinition}
          />
          {largeAnnotationSide === 'left' ? annotationPanel : null}
        </ScrollView>
      }
      rightGutter={
        <ScrollView
          style={{flex: 1, backgroundColor: 'transparent'}}
          contentContainerStyle={{paddingBottom: 24}}
          showsVerticalScrollIndicator={false}>
          {largeAnnotationSide === 'right' ? annotationPanel : null}
          {FORMS_ENABLED && file && formStatus !== 'idle' ? (
            <FormFieldsPanel
              status={formStatus}
              fields={formFields}
              selectedFieldId={selectedFieldId}
              error={formError}
              onSelectField={selectFormField}
              onClose={clearFormAnalysis}
            />
          ) : null}
        </ScrollView>
      }>
      {file ? (
        <PdfViewer
          viewerRef={pdfRef}
          sourceUri={file.uri}
          base64={file.base64}
          formFields={showFormOverlays ? formFields : undefined}
          selectedFieldId={FORMS_ENABLED ? selectedFieldId : null}
          pinnedAnnotations={pinnedPins}
          selectedPinnedId={selectedPinnedId ?? viewingPinnedId}
          activeMarginAnnotation={activeMarginAnnotation}
          colorScheme={appearanceMode}
          onWordClick={onWordClick}
          onPhraseSelect={onPhraseSelect}
          onPinnedAnnotationClick={onPinnedAnnotationClick}
          onPageReady={onPageReady}
          onFormFieldClick={FORMS_ENABLED ? selectFormField : undefined}
          onFormFieldChange={FORMS_ENABLED ? setFieldValue : undefined}
          onHeuristicFields={FORMS_ENABLED ? onHeuristicFields : undefined}
          onAcroformFields={FORMS_ENABLED ? onAcroformFields : undefined}
          onFormPageImages={FORMS_ENABLED ? onFormPageImages : undefined}
          onError={message => Alert.alert('PDF error', message)}
        />
      ) : null}
    </ReaderShell>
    </ThemeProvider>
  );
}

export default App;
