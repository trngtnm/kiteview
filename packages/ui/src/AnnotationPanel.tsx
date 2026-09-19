import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  AnnotationMode,
  AnnotationStatus,
  PhraseAnnotation,
} from '@kiteview/core';
import {theme} from './theme';

type AnnotationPanelProps = {
  phrase: string | null;
  mode: AnnotationMode;
  status: AnnotationStatus;
  annotation: PhraseAnnotation | null;
  error: string | null;
  pinned?: boolean;
  canPin?: boolean;
  onModeChange: (mode: AnnotationMode) => void;
  onPin?: () => void;
  onUnpin?: () => void;
  onClose: () => void;
};

export function AnnotationPanel({
  phrase,
  mode,
  status,
  annotation,
  error,
  pinned = false,
  canPin = false,
  onModeChange,
  onPin,
  onUnpin,
  onClose,
}: AnnotationPanelProps) {
  if (!phrase || status === 'idle') return null;

  const loadingLabel =
    mode === 'summarize' ? 'Summarizing…' : 'Explaining in plain language…';

  return (
    <View style={styles.wrapper}>
      <View style={styles.card} accessibilityLabel={`Annotation of ${phrase}`}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={3}>
            {phrase}
          </Text>
          <View style={styles.headerActions}>
            {status === 'ready' && pinned && onUnpin ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Unpin annotation"
                onPress={onUnpin}
                style={styles.pinBtn}>
                <Text style={styles.pinBtnLabel}>Unpin</Text>
              </Pressable>
            ) : null}
            {status === 'ready' && !pinned && canPin && onPin ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pin annotation"
                onPress={onPin}
                style={[styles.pinBtn, styles.pinBtnPrimary]}>
                <Text style={[styles.pinBtnLabel, styles.pinBtnLabelPrimary]}>
                  Pin
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close annotation"
              onPress={onClose}
              style={styles.close}>
              <Text style={styles.closeLabel}>✕</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.modeRow}>
          <ModeChip
            label="Explain"
            active={mode === 'explain'}
            onPress={() => onModeChange('explain')}
          />
          <ModeChip
            label="Summarize"
            active={mode === 'summarize'}
            onPress={() => onModeChange('summarize')}
          />
        </View>

        {status === 'loading' ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.accent} />
            <Text style={styles.meta}>{loadingLabel}</Text>
          </View>
        ) : null}
        {status === 'error' ? (
          <Text style={styles.error}>
            {error || 'Could not annotate selection.'}
          </Text>
        ) : null}
        {status === 'ready' && annotation ? (
          <Text style={styles.content}>{annotation.content}</Text>
        ) : null}
      </View>
    </View>
  );
}

function ModeChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
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

const styles = StyleSheet.create({
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
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 2},
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    flex: 1,
    color: theme.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  pinBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F0F0F2',
  },
  pinBtnPrimary: {
    backgroundColor: theme.accent,
  },
  pinBtnLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  pinBtnLabelPrimary: {
    color: '#FFFFFF',
  },
  close: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F2',
  },
  closeLabel: {color: theme.textSecondary, fontSize: 13, fontWeight: '600'},
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F0F0F2',
  },
  chipActive: {
    backgroundColor: theme.accent,
  },
  chipLabel: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipLabelActive: {
    color: '#FFFFFF',
  },
  loading: {marginTop: 16, alignItems: 'center', gap: 8},
  meta: {color: theme.textSecondary, fontSize: 13},
  content: {
    marginTop: 14,
    color: theme.textPrimary,
    fontSize: 14,
    lineHeight: 21,
  },
  error: {marginTop: 12, color: '#C62828', fontSize: 14, lineHeight: 20},
});
