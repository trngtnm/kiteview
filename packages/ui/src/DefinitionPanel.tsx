import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {DefinitionStatus, WordDefinition} from '@kiteview/core';
import {
  FrostedPanel,
  frostedPanelChromeFor,
  type FrostedPanelChrome,
} from './FrostedPanel';
import {useColorScheme} from './ThemeProvider';

type DefinitionPanelProps = {
  word: string | null;
  status: DefinitionStatus;
  definition: WordDefinition | null;
  error: string | null;
  onClose: () => void;
};

const PANEL_SOFT_MAX_WIDTH = 320;

export function DefinitionPanel({
  word,
  status,
  definition,
  error,
  onClose,
}: DefinitionPanelProps) {
  const scheme = useColorScheme();
  const chrome = useMemo(() => frostedPanelChromeFor(scheme), [scheme]);
  const styles = useMemo(() => createStyles(chrome), [chrome]);

  if (!word || status === 'idle') {
    return null;
  }

  const title = word;
  const showDefinition =
    definition != null &&
    definition.word.toLowerCase() === word.toLowerCase() &&
    (status === 'ready' || status === 'loading');

  return (
    <View style={styles.wrapper}>
      <FrostedPanel
        accessibilityLabel={`Definition of ${title}`}
        scheme={scheme}
        style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close definition"
            onPress={onClose}
            hitSlop={8}
            style={({pressed}) => [
              styles.closeBtn,
              pressed && styles.closePressed,
            ]}>
            <Text style={styles.closeLabel}>✕</Text>
          </Pressable>
        </View>

        {showDefinition && definition.phonetic ? (
          <Text style={styles.phonetic}>{definition.phonetic}</Text>
        ) : null}

        {status === 'loading' && !showDefinition ? (
          <View style={styles.centered}>
            <ActivityIndicator color={chrome.accent} />
            <Text style={styles.meta}>Looking up…</Text>
          </View>
        ) : null}

        {status === 'loading' && showDefinition ? (
          <Text style={styles.metaInline}>Updating…</Text>
        ) : null}

        {status === 'error' ? (
          <Text style={styles.error}>
            {error === 'No definition found'
              ? 'No definition found.'
              : error || 'Could not load definition.'}
          </Text>
        ) : null}

        {showDefinition ? (
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}>
            {definition.meanings.map((meaning, index) => (
              <View
                key={`${meaning.partOfSpeech}-${index}`}
                style={styles.meaning}>
                {meaning.partOfSpeech ? (
                  <Text style={styles.pos}>{meaning.partOfSpeech}</Text>
                ) : null}
                {meaning.definitions.map((def, defIndex) => (
                  <Text key={defIndex} style={styles.definition}>
                    {def}
                  </Text>
                ))}
              </View>
            ))}
          </ScrollView>
        ) : null}
      </FrostedPanel>
    </View>
  );
}

function createStyles(chrome: FrostedPanelChrome) {
  return StyleSheet.create({
    wrapper: {
      alignSelf: 'stretch',
      width: '100%',
      paddingTop: 20,
      paddingHorizontal: 10,
      alignItems: 'stretch',
    },
    card: {
      alignSelf: 'stretch',
      width: '100%',
      maxWidth: PANEL_SOFT_MAX_WIDTH,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: chrome.inputBorder,
      maxHeight: 420,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
    },
    title: {
      flex: 1,
      color: chrome.textPrimary,
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    closeBtn: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: chrome.chipBg,
    },
    closePressed: {
      opacity: 0.7,
    },
    closeLabel: {
      color: chrome.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    phonetic: {
      marginTop: 4,
      color: chrome.textSecondary,
      fontSize: 13,
    },
    centered: {
      marginTop: 16,
      alignItems: 'center',
      gap: 8,
    },
    meta: {
      color: chrome.textSecondary,
      fontSize: 13,
    },
    metaInline: {
      marginTop: 8,
      color: chrome.textSecondary,
      fontSize: 12,
    },
    error: {
      marginTop: 12,
      color: chrome.danger,
      fontSize: 14,
      lineHeight: 20,
    },
    body: {
      marginTop: 12,
    },
    bodyContent: {
      paddingBottom: 4,
      gap: 12,
    },
    meaning: {
      gap: 6,
    },
    pos: {
      color: chrome.accent,
      fontSize: 12,
      fontWeight: '600',
      fontStyle: 'italic',
      textTransform: 'lowercase',
    },
    definition: {
      color: chrome.textPrimary,
      fontSize: 14,
      lineHeight: 20,
    },
  });
}
