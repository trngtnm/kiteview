import {create} from 'zustand';
import {getSupabase} from './supabaseClient';

export type ReadingLevel =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'academic';

export type ReadingTone = 'concise' | 'conversational' | 'formal';

export type ReadingPreferences = {
  readingLevel: ReadingLevel;
  nativeLanguage: string;
  explanationLanguage: string;
  domainTags: string[];
  tone: ReadingTone;
  /** Free-text guidance appended to the annotate system prompt. */
  customInstructions: string;
};

export const DEFAULT_READING_PREFERENCES: ReadingPreferences = {
  readingLevel: 'intermediate',
  nativeLanguage: 'en',
  explanationLanguage: 'en',
  domainTags: [],
  tone: 'conversational',
  customInstructions: '',
};

export const READING_LEVELS: ReadingLevel[] = [
  'beginner',
  'intermediate',
  'advanced',
  'academic',
];

export const READING_TONES: ReadingTone[] = [
  'concise',
  'conversational',
  'formal',
];

export const DOMAIN_TAG_OPTIONS = [
  'legal',
  'medical',
  'technical',
  'financial',
  'literary',
] as const;

type PreferencesStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

type PreferencesState = {
  preferences: ReadingPreferences;
  status: PreferencesStatus;
  error: string | null;
  dirty: boolean;
  loadPreferences: (userId: string) => Promise<void>;
  setLocal: (partial: Partial<ReadingPreferences>) => void;
  toggleDomainTag: (tag: string) => void;
  savePreferences: (userId: string) => Promise<boolean>;
  resetToDefaults: () => void;
};

function mapRow(row: {
  reading_level?: string;
  native_language?: string;
  explanation_language?: string;
  domain_tags?: string[] | null;
  tone?: string;
  custom_instructions?: string | null;
}): ReadingPreferences {
  const level = row.reading_level;
  const tone = row.tone;
  return {
    readingLevel: READING_LEVELS.includes(level as ReadingLevel)
      ? (level as ReadingLevel)
      : DEFAULT_READING_PREFERENCES.readingLevel,
    nativeLanguage:
      row.native_language?.trim() ||
      DEFAULT_READING_PREFERENCES.nativeLanguage,
    explanationLanguage:
      row.explanation_language?.trim() ||
      DEFAULT_READING_PREFERENCES.explanationLanguage,
    domainTags: Array.isArray(row.domain_tags)
      ? row.domain_tags.filter(Boolean)
      : [],
    tone: READING_TONES.includes(tone as ReadingTone)
      ? (tone as ReadingTone)
      : DEFAULT_READING_PREFERENCES.tone,
    customInstructions:
      typeof row.custom_instructions === 'string'
        ? row.custom_instructions
        : '',
  };
}

export const usePreferencesStore = create<PreferencesState>(set => ({
  preferences: {...DEFAULT_READING_PREFERENCES},
  status: 'idle',
  error: null,
  dirty: false,

  resetToDefaults: () =>
    set({
      preferences: {...DEFAULT_READING_PREFERENCES},
      status: 'idle',
      error: null,
      dirty: false,
    }),

  setLocal: partial =>
    set(state => ({
      preferences: {...state.preferences, ...partial},
      dirty: true,
      error: null,
    })),

  toggleDomainTag: tag =>
    set(state => {
      const has = state.preferences.domainTags.includes(tag);
      const domainTags = has
        ? state.preferences.domainTags.filter(t => t !== tag)
        : [...state.preferences.domainTags, tag];
      return {
        preferences: {...state.preferences, domainTags},
        dirty: true,
        error: null,
      };
    }),

  loadPreferences: async userId => {
    const supabase = getSupabase();
    if (!supabase || !userId) {
      set({
        preferences: {...DEFAULT_READING_PREFERENCES},
        status: 'ready',
        dirty: false,
        error: null,
      });
      return;
    }
    set({status: 'loading', error: null});
    const {data, error} = await supabase
      .from('reading_preferences')
      .select(
        'reading_level, native_language, explanation_language, domain_tags, tone, custom_instructions',
      )
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      set({
        status: 'error',
        error: error.message,
      });
      return;
    }
    set({
      preferences: data
        ? mapRow(data)
        : {...DEFAULT_READING_PREFERENCES},
      status: 'ready',
      dirty: false,
      error: null,
    });
  },

  savePreferences: async userId => {
    const supabase = getSupabase();
    if (!supabase || !userId) {
      set({error: 'Sign in to save preferences', status: 'ready'});
      return false;
    }
    const prefs = usePreferencesStore.getState().preferences;
    set({status: 'saving', error: null});
    const {error} = await supabase.from('reading_preferences').upsert(
      {
        user_id: userId,
        reading_level: prefs.readingLevel,
        native_language: prefs.nativeLanguage.trim() || 'en',
        explanation_language: prefs.explanationLanguage.trim() || 'en',
        domain_tags: prefs.domainTags,
        tone: prefs.tone,
        custom_instructions: prefs.customInstructions.trim().slice(0, 1000),
        updated_at: new Date().toISOString(),
      },
      {onConflict: 'user_id'},
    );
    if (error) {
      set({status: 'error', error: error.message});
      return false;
    }
    set({status: 'ready', dirty: false, error: null});
    return true;
  },
}));
