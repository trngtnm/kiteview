import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import type {ParaphraseStatus, PhraseAnnotation} from '@kiteview/core';
import {theme} from './theme';

type ParaphrasePanelProps = {
  phrase: string | null;
  status: ParaphraseStatus;
  annotation: PhraseAnnotation | null;
  error: string | null;
  onClose: () => void;
};

export function ParaphrasePanel({
  phrase,
  status,
  annotation,
  error,
  onClose,
}: ParaphrasePanelProps) {
  if (!phrase || status === 'idle') return null;
  return (
    <View style={styles.wrapper}>
      <View style={styles.card} accessibilityLabel={`Paraphrase of ${phrase}`}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={3}>{phrase}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close paraphrase" onPress={onClose} style={styles.close}>
            <Text style={styles.closeLabel}>✕</Text>
          </Pressable>
        </View>
        {status === 'loading' ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.accent} />
            <Text style={styles.meta}>Explaining in plain language…</Text>
          </View>
        ) : null}
        {status === 'error' ? <Text style={styles.error}>{error || 'Could not paraphrase phrase.'}</Text> : null}
        {status === 'ready' && annotation ? <Text style={styles.content}>{annotation.content}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {alignSelf: 'stretch', width: '100%', paddingTop: 20, paddingHorizontal: 10},
  card: {width: '100%', maxWidth: 320, padding: 14, borderRadius: 12, backgroundColor: theme.pageSurface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: {width: 0, height: 2}},
  header: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8},
  title: {flex: 1, color: theme.textPrimary, fontSize: 17, fontWeight: '700'},
  close: {width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F0F2'},
  closeLabel: {color: theme.textSecondary, fontSize: 13, fontWeight: '600'},
  loading: {marginTop: 16, alignItems: 'center', gap: 8},
  meta: {color: theme.textSecondary, fontSize: 13},
  content: {marginTop: 14, color: theme.textPrimary, fontSize: 14, lineHeight: 21},
  error: {marginTop: 12, color: '#C62828', fontSize: 14, lineHeight: 20},
});
