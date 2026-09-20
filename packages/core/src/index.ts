export {getEnv, setEnv, isEnvConfigured, isSupabaseEnvConfigured, resolveAnnotateEndpointUrl} from './env';
export type {EnvConfig} from './env';
export {
  pickPdfFile,
  registerPickPdfFile,
  renamePdfFile,
  registerRenamePdfFile,
  registerAnnotatePhrase,
  annotatePhrase,
} from './filePicker';
export type {
  PickedPdfFile,
  PickPdfFileFn,
  RenamePdfFileFn,
} from './filePicker';
export {useDocumentStore} from './store';
export type {DocumentTab} from './store';
export {fetchWordDefinition} from './dictionary';
export type {WordDefinition, WordMeaning} from './dictionary';
export {useDefinitionStore} from './definitionStore';
export type {DefinitionStatus} from './definitionStore';
export {
  fetchPhraseAnnotation,
  inferAnnotationMode,
} from './annotation';
export type {
  AnnotationMode,
  FetchAnnotationOptions,
  PhraseAnnotation,
} from './annotation';
export {useAnnotationStore} from './annotationStore';
export type {AnnotationStatus} from './annotationStore';
/** @deprecated Use useAnnotationStore */
export {useAnnotationStore as useParaphraseStore} from './annotationStore';
/** @deprecated Use AnnotationStatus */
export type {AnnotationStatus as ParaphraseStatus} from './annotationStore';
export {
  usePinnedAnnotationStore,
  chooseMarginSide,
} from './pinnedAnnotationStore';
export type {
  PinnedAnnotation,
  PinAnnotationInput,
  RectNorm,
} from './pinnedAnnotationStore';
export {
  useFormAnalysisStore,
  mergeFields,
  dedupeFields,
  preloadFormAnalysis,
  VISION_SPARSE_THRESHOLD,
} from './formAnalysisStore';
export type {
  FormAnalysisStatus,
  FormDetectionSource,
  FormCascadeStage,
} from './formAnalysisStore';
export {
  getSupabase,
  getSession,
  onAuthStateChange,
  signInWithPassword,
  signUpWithPassword,
  signOut,
  invokeFormsDetect,
  isSupabaseConfigured,
} from './supabaseClient';
export type {
  FormPageImage,
  FormsDetectRequest,
  FormsDetectResponse,
} from './supabaseClient';
export {useAuthStore} from './authStore';
export type {AuthStatus} from './authStore';
export {
  usePreferencesStore,
  DEFAULT_READING_PREFERENCES,
  READING_LEVELS,
  READING_TONES,
  DOMAIN_TAG_OPTIONS,
} from './preferencesStore';
export type {
  ReadingPreferences,
  ReadingLevel,
  ReadingTone,
} from './preferencesStore';
export {useAppearanceStore} from './appearanceStore';
export type {AppearanceMode} from './appearanceStore';
