import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  AnnotationMode,
  AnnotationStatus,
  PhraseAnnotation,
} from '@kiteview/core';
import {useTheme} from './ThemeProvider';
import type {Theme} from './theme';

type AnnotationPanelProps = {
  phrase: string | null;
  mode: AnnotationMode;
  status: AnnotationStatus;
  annotation: PhraseAnnotation | null;
  error: string | null;
  pageNumber?: number | null;
  userComment?: string;
  pinned?: boolean;
  canPin?: boolean;
  onModeChange: (mode: AnnotationMode) => void;
  onUserCommentChange: (comment: string) => void;
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
  pageNumber,
  userComment = '',
  pinned = false,
  canPin = false,
  onModeChange,
  onUserCommentChange,
  onPin,
  onUnpin,
  onClose,
}: AnnotationPanelProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [draft, setDraft] = useState(userComment);
  const draftRef = useRef(userComment);

  useEffect(() => {
    setDraft(userComment);
    draftRef.current = userComment;
  }, [userComment, phrase]);

  if (!phrase || status === 'idle') return null;

  const page = pageNumber && pageNumber > 0 ? pageNumber : 1;
  const modeLabel =
    mode === 'summarize'
      ? 'Summary'
      : mode === 'explain'
        ? 'Explanation'
        : 'Annotation';
  const title = `${modeLabel} on page ${page}`;
  const loadingLabel =
    mode === 'summarize' ? 'Summarizing…' : 'Explaining in plain language…';
  const showComment = status === 'ready' || status === 'error';

  const commitDraft = (text: string) => {
    draftRef.current = text;
    setDraft(text);
    onUserCommentChange(text);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.card} accessibilityLabel={title}>
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <Text style={styles.phrase} numberOfLines={3}>
              {phrase}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {status === 'ready' && pinned && onUnpin ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Unpin annotation"
                onPress={onUnpin}
                style={[styles.pinBtn, styles.pinBtnPrimary]}>
                <PinIcon color={theme.accentText} filled />
              </Pressable>
            ) : null}
            {status === 'ready' && !pinned && canPin && onPin ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pin annotation"
                onPress={onPin}
                style={styles.pinBtn}>
                <PinIcon color={theme.textSecondary} filled={false} />
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
            styles={styles}
          />
          <ModeChip
            label="Summarize"
            active={mode === 'summarize'}
            onPress={() => onModeChange('summarize')}
            styles={styles}
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

        {showComment ? (
          <View style={styles.commentBlock}>
            <Text style={styles.commentLabel}>Your comment</Text>
            <TextInput
              accessibilityLabel="Annotation comment"
              multiline
              onChange={event => commitDraft(event.nativeEvent?.text ?? '')}
              onChangeText={commitDraft}
              onEndEditing={event =>
                commitDraft(event.nativeEvent?.text ?? draftRef.current)
              }
              placeholder="Add your own notes about this selection…"
              placeholderTextColor={theme.textSecondary}
              style={styles.commentInput}
              value={draft}
              textAlignVertical="top"
            />
            {pinned ? (
              <Text style={styles.commentHint}>Saved with this pin.</Text>
            ) : (
              <Text style={styles.commentHint}>
                Pin this annotation to keep your comment with the highlight.
              </Text>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function PinIcon({color, filled}: {color: string; filled: boolean}) {
  return (
    <View style={pinIconStyles.wrap} pointerEvents="none">
      <View
        style={[
          pinIconStyles.head,
          {borderColor: color, backgroundColor: filled ? color : 'transparent'},
        ]}
      />
      <View
        style={[
          pinIconStyles.needle,
          {
            borderTopColor: color,
          },
        ]}
      />
    </View>
  );
}

const pinIconStyles = StyleSheet.create({
  wrap: {
    width: 12,
    height: 15,
    alignItems: 'center',
  },
  head: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  needle: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});

function ModeChip({
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
      borderWidth: 2,
      borderColor: theme.accentBorder,
      shadowColor: theme.shadow,
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
    titleBlock: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 17,
      fontWeight: '700',
    },
    phrase: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    pinBtn: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.chipBg,
    },
    pinBtnPrimary: {
      backgroundColor: theme.accent,
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
    modeRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.chipBg,
    },
    chipActive: {
      backgroundColor: theme.chipBgActive,
    },
    chipLabel: {
      color: theme.chipText,
      fontSize: 13,
      fontWeight: '600',
    },
    chipLabelActive: {
      color: theme.chipTextActive,
    },
    loading: {marginTop: 16, alignItems: 'center', gap: 8},
    meta: {color: theme.textSecondary, fontSize: 13},
    content: {
      marginTop: 14,
      color: theme.textPrimary,
      fontSize: 14,
      lineHeight: 21,
    },
    error: {marginTop: 12, color: theme.danger, fontSize: 14, lineHeight: 20},
    commentBlock: {
      marginTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.inputBorder,
      paddingTop: 12,
    },
    commentLabel: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 8,
    },
    commentInput: {
      minHeight: 72,
      maxHeight: 140,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 13,
      lineHeight: 18,
      color: theme.textPrimary,
      backgroundColor: theme.inputBg,
    },
    commentHint: {
      marginTop: 8,
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
  });
}
