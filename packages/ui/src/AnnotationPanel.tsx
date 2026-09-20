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
  userComment?: string;
  pinned?: boolean;
  canPin?: boolean;
  onModeChange: (mode: AnnotationMode) => void;
  onUserCommentChange: (comment: string) => void;
  onSaveComment?: () => void;
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
  userComment = '',
  pinned = false,
  canPin = false,
  onModeChange,
  onUserCommentChange,
  onSaveComment,
  onPin,
  onUnpin,
  onClose,
}: AnnotationPanelProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [draft, setDraft] = useState(userComment);
  const [commentDirty, setCommentDirty] = useState(false);
  const draftRef = useRef(userComment);

  useEffect(() => {
    setDraft(userComment);
    draftRef.current = userComment;
    setCommentDirty(false);
  }, [userComment, phrase]);

  if (!phrase || status === 'idle') return null;

  const loadingLabel =
    mode === 'summarize' ? 'Summarizing…' : 'Explaining in plain language…';
  const showComment = status === 'ready' || status === 'error';

  const commitDraft = (text: string) => {
    draftRef.current = text;
    setDraft(text);
    setCommentDirty(text !== userComment);
    onUserCommentChange(text);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.card} accessibilityLabel={`Annotation of ${phrase}`}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
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
            {pinned && onSaveComment ? (
              <Pressable
                accessibilityRole="button"
                disabled={!commentDirty}
                onPress={() => {
                  onSaveComment();
                  setCommentDirty(false);
                }}
                style={[
                  styles.saveCommentBtn,
                  !commentDirty && styles.saveCommentDisabled,
                ]}>
                <Text style={styles.saveCommentLabel}>
                  {commentDirty ? 'Save comment' : 'Comment saved'}
                </Text>
              </Pressable>
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
      backgroundColor: theme.chipBg,
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
      color: theme.accentText,
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
    saveCommentBtn: {
      marginTop: 8,
      alignSelf: 'flex-start',
      backgroundColor: theme.accent,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    saveCommentDisabled: {
      opacity: 0.45,
    },
    saveCommentLabel: {
      color: theme.accentText,
      fontSize: 12,
      fontWeight: '700',
    },
  });
}
