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
import {FrostedPanel, frostedPanelChrome as chrome} from './FrostedPanel';

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
  const styles = useMemo(() => createStyles(), []);
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
      <FrostedPanel accessibilityLabel={title} style={styles.card}>
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
            <ActivityIndicator color={chrome.accent} />
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
              placeholderTextColor={chrome.textSecondary}
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
      </FrostedPanel>
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

function createStyles() {
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
      borderWidth: 2,
      borderColor: chrome.border,
      shadowColor: chrome.shadow,
      shadowOpacity: 0.32,
      shadowRadius: 16,
      shadowOffset: {width: 0, height: 4},
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
      color: chrome.textPrimary,
      fontSize: 17,
      fontWeight: '700',
    },
    phrase: {
      color: chrome.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    pinBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: chrome.chipBg,
    },
    pinBtnPrimary: {
      backgroundColor: chrome.accent,
    },
    pinBtnLabel: {
      color: chrome.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    pinBtnLabelPrimary: {
      color: chrome.accentText,
    },
    close: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: chrome.chipBg,
    },
    closeLabel: {color: chrome.textSecondary, fontSize: 13, fontWeight: '600'},
    modeRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: chrome.chipBg,
    },
    chipActive: {
      backgroundColor: chrome.chipBgActive,
    },
    chipLabel: {
      color: chrome.chipText,
      fontSize: 13,
      fontWeight: '600',
    },
    chipLabelActive: {
      color: chrome.chipTextActive,
    },
    loading: {marginTop: 16, alignItems: 'center', gap: 8},
    meta: {color: chrome.textSecondary, fontSize: 13},
    content: {
      marginTop: 14,
      color: chrome.textPrimary,
      fontSize: 14,
      lineHeight: 21,
    },
    error: {marginTop: 12, color: chrome.danger, fontSize: 14, lineHeight: 20},
    commentBlock: {
      marginTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: chrome.inputBorder,
      paddingTop: 12,
    },
    commentLabel: {
      color: chrome.textSecondary,
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
      borderColor: chrome.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 13,
      lineHeight: 18,
      color: chrome.textPrimary,
      backgroundColor: chrome.inputBg,
    },
    commentHint: {
      marginTop: 8,
      color: chrome.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
  });
}
