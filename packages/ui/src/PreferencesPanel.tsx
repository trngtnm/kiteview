import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  ReadingLevel,
  ReadingPreferences,
  ReadingTone,
} from '@kiteview/core';
import {
  DOMAIN_TAG_OPTIONS,
  READING_LEVELS,
  READING_TONES,
} from '@kiteview/core';
import {useTheme} from './ThemeProvider';
import type {Theme} from './theme';

type PreferencesPanelProps = {
  preferences: ReadingPreferences;
  signedIn: boolean;
  busy?: boolean;
  dirty?: boolean;
  error?: string | null;
  onChange: (partial: Partial<ReadingPreferences>) => void;
  onToggleDomain: (tag: string) => void;
  onSave: () => void;
  onClose: () => void;
  onOpenAuth?: () => void;
};

function Chip({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{selected: active}}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PreferencesPanel({
  preferences,
  signedIn,
  busy = false,
  dirty = false,
  error,
  onChange,
  onToggleDomain,
  onSave,
  onClose,
  onOpenAuth,
}: PreferencesPanelProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.card} accessibilityLabel="Reading preferences">
        <View style={styles.header}>
          <Text style={styles.title}>Reading preferences</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close preferences"
            onPress={onClose}
            style={styles.close}>
            <Text style={styles.closeLabel}>✕</Text>
          </Pressable>
        </View>

        {!signedIn ? (
          <Text style={styles.meta}>
            Sign in to save preferences. Guests use intermediate /
            conversational defaults for annotations.
          </Text>
        ) : (
          <Text style={styles.meta}>
            Explain and Summarize use these settings on the server.
          </Text>
        )}

        <Text style={styles.label}>Reading level</Text>
        <View style={styles.row}>
          {READING_LEVELS.map((level: ReadingLevel) => (
            <Chip
              key={level}
              label={level}
              active={preferences.readingLevel === level}
              onPress={() => onChange({readingLevel: level})}
              styles={styles}
            />
          ))}
        </View>

        <Text style={styles.label}>Tone</Text>
        <View style={styles.row}>
          {READING_TONES.map((tone: ReadingTone) => (
            <Chip
              key={tone}
              label={tone}
              active={preferences.tone === tone}
              onPress={() => onChange({tone})}
              styles={styles}
            />
          ))}
        </View>

        <Text style={styles.label}>Domains</Text>
        <View style={styles.row}>
          {DOMAIN_TAG_OPTIONS.map(tag => (
            <Chip
              key={tag}
              label={tag}
              active={preferences.domainTags.includes(tag)}
              onPress={() => onToggleDomain(tag)}
              styles={styles}
            />
          ))}
        </View>

        <Text style={styles.label}>Native language</Text>
        <TextInput
          accessibilityLabel="Native language"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={nativeLanguage => onChange({nativeLanguage})}
          placeholder="en"
          placeholderTextColor={theme.textSecondary}
          style={styles.input}
          value={preferences.nativeLanguage}
        />

        <Text style={styles.label}>Explanation language</Text>
        <TextInput
          accessibilityLabel="Explanation language"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={explanationLanguage =>
            onChange({explanationLanguage})
          }
          placeholder="en"
          placeholderTextColor={theme.textSecondary}
          style={styles.input}
          value={preferences.explanationLanguage}
        />

        <Text style={styles.label}>Custom GPT preferences</Text>
        <Text style={styles.fieldHint}>
          Optional. Extra instructions for Explain and Summarize (for example:
          “use simple analogies”, “focus on legal implications”).
        </Text>
        <TextInput
          accessibilityLabel="Custom GPT preferences"
          multiline
          onChangeText={customInstructions =>
            onChange({customInstructions})
          }
          placeholder="Optional custom instructions for the AI…"
          placeholderTextColor={theme.textSecondary}
          style={styles.multilineInput}
          value={preferences.customInstructions}
          textAlignVertical="top"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {signedIn ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy || !dirty}
            onPress={onSave}
            style={[styles.primary, (busy || !dirty) && styles.disabled]}>
            {busy ? (
              <ActivityIndicator color={theme.accentText} />
            ) : (
              <Text style={styles.primaryLabel}>
                {dirty ? 'Save preferences' : 'Saved'}
              </Text>
            )}
          </Pressable>
        ) : onOpenAuth ? (
          <Pressable
            accessibilityRole="button"
            onPress={onOpenAuth}
            style={styles.primary}>
            <Text style={styles.primaryLabel}>Sign in to save</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    wrapper: {
      alignSelf: 'stretch',
      width: '100%',
      paddingTop: 12,
      paddingHorizontal: 10,
    },
    card: {
      width: '100%',
      maxWidth: 320,
      padding: 14,
      borderRadius: 12,
      backgroundColor: theme.pageSurface,
      shadowColor: theme.shadow,
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: {width: 0, height: 2},
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    title: {
      flex: 1,
      color: theme.textPrimary,
      fontSize: 17,
      fontWeight: '700',
    },
    close: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.chipBg,
    },
    closeLabel: {color: theme.textSecondary, fontSize: 13, fontWeight: '600'},
    meta: {
      marginTop: 8,
      marginBottom: 4,
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    label: {
      marginTop: 14,
      marginBottom: 8,
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.chipBg,
    },
    chipActive: {
      backgroundColor: theme.chipBgActive,
    },
    chipLabel: {
      color: theme.chipText,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    chipLabelActive: {
      color: theme.chipTextActive,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.textPrimary,
      backgroundColor: theme.inputBg,
    },
    fieldHint: {
      marginBottom: 8,
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
    multilineInput: {
      minHeight: 88,
      maxHeight: 160,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      lineHeight: 20,
      color: theme.textPrimary,
      backgroundColor: theme.inputBg,
    },
    primary: {
      marginTop: 16,
      backgroundColor: theme.accent,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
    },
    disabled: {opacity: 0.45},
    primaryLabel: {color: theme.accentText, fontSize: 14, fontWeight: '700'},
    error: {marginTop: 10, color: theme.danger, fontSize: 13, lineHeight: 18},
  });
}
