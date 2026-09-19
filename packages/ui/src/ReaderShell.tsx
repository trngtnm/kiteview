import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  findNodeHandle,
  ImageSourcePropType,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {EmptyState} from './EmptyState';
import {GutterSlot} from './GutterSlot';
import {SidebarRail} from './SidebarRail';
import type {DocumentTab} from '@kiteview/core';
import {
  PDF_COLUMN_MAX_WIDTH,
  RAIL_WIDTH,
  STAGE_SCROLLBAR_WIDTH,
  theme,
} from './theme';

const KeyboardSurface = View as React.ComponentType<any>;

type ReaderShellProps = {
  fileName?: string | null;
  tabs: DocumentTab[];
  activeTabId: string | null;
  logoSource: ImageSourcePropType;
  onSelectFile: () => void;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onClearFile?: () => void;
  onRenameFile: (name: string) => void;
  onSaveFile: (name: string) => void;
  /** Opt-in form detection — never runs on open. */
  onDetectForms?: () => void;
  formsDetectLabel?: string;
  formsDetectDisabled?: boolean;
  formFieldCount?: number;
  /** Content for the left gutter (e.g. definition panel). */
  leftGutter?: React.ReactNode;
  /** Content for the right gutter (e.g. form fields panel). */
  rightGutter?: React.ReactNode;
  children?: React.ReactNode;
};

/**
 * Fora-inspired reader chrome:
 * collapsible left rail + main stage with centered column and empty side gutters
 * (reserved for future AI annotations / comments / descriptions).
 * fixed left rail + main stage with centered column and empty side gutters
 * (left gutter hosts definition / future AI annotations).
 */
export function ReaderShell({
  fileName,
  tabs,
  activeTabId,
  logoSource,
  onSelectFile,
  onSelectTab,
  onCloseTab,
  onClearFile,
  onRenameFile,
  onSaveFile,
  onDetectForms,
  formsDetectLabel,
  formsDetectDisabled,
  formFieldCount,
  leftGutter,
  rightGutter,
  children,
}: ReaderShellProps) {
  const hasDocument = Boolean(children);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [nameFieldFocused, setNameFieldFocused] = useState(false);
  const [caretVisible, setCaretVisible] = useState(true);
  const [toggleHovered, setToggleHovered] = useState(false);
  const toggleHoverProgress = useRef(new Animated.Value(0)).current;
  const [selectionStart, setSelectionStart] = useState(0);
  const [caretTextWidth, setCaretTextWidth] = useState(0);
  const [editingFileName, setEditingFileName] = useState(
    fileName?.replace(/\.pdf$/i, '') ?? '',
  );
  const nameInputRef = useRef<TextInput>(null);
  const sidebarOffset = useRef(new Animated.Value(0)).current;
  // Inset the stage when the rail is open so gutters/PDF never sit under it.
  // Do not translate the WebView — that offsets caret/highlight hit-testing.
  const stageLeft = sidebarOffset.interpolate({
    inputRange: [-RAIL_WIDTH, 0],
    outputRange: [0, RAIL_WIDTH],
  });

  useEffect(() => {
    setEditingFileName(fileName?.replace(/\.pdf$/i, '') ?? '');
    setSelectionStart(0);
  }, [fileName]);

  useEffect(() => {
    const animation = Animated.timing(sidebarOffset, {
      toValue: sidebarVisible ? 0 : -RAIL_WIDTH,
      duration: 220,
      useNativeDriver: false,
    });

    animation.start();

    return () => animation.stop();
  }, [sidebarOffset, sidebarVisible]);

  useEffect(() => {
    if (!nameFieldFocused) {
      return;
    }
    setCaretVisible(true);
    const blinkTimer = setInterval(() => {
      setCaretVisible(visible => !visible);
    }, 530);
    return () => clearInterval(blinkTimer);
  }, [nameFieldFocused]);

  const toggleSidebar = () => {
    setSidebarVisible(visible => !visible);
  };

  const setToggleHover = (value: boolean) => {
    setToggleHovered(value);
    Animated.timing(toggleHoverProgress, {
      toValue: value ? 1 : 0,
      duration: value ? 650 : 450,
      useNativeDriver: true,
    }).start();
  };

  return (
    <KeyboardSurface
      style={styles.window}
      onTouchEnd={(event: any) => {
        const inputTarget = nameInputRef.current
          ? Number(findNodeHandle(nameInputRef.current))
          : null;
        if (inputTarget == null || event.nativeEvent.target !== inputTarget) {
          Keyboard.dismiss();
        }
      }}
      onKeyDown={(event: any) => {
        if ((event.metaKey || event.ctrlKey) && event.key?.toLowerCase() === 's') {
          event.preventDefault?.();
          onSaveFile(editingFileName.trim());
        }
      }}>
      <Animated.View style={[styles.stage, {left: stageLeft}]}>
        <View style={styles.readerLayer}>
          {hasDocument ? (
            <View style={styles.documentStage}>
              <View style={styles.pdfLayer}>{children}</View>
              <View style={styles.gutterOverlay} pointerEvents="box-none">
                <GutterSlot side="left">{leftGutter}</GutterSlot>
                <View style={styles.pdfColumnSpacer} />
                <GutterSlot side="right">{rightGutter}</GutterSlot>
              </View>
            </View>
          ) : (
            <EmptyState onSelectFile={onSelectFile} />
          )}
        </View>
        {fileName ? (
          <View style={styles.fileNameBar}>
            <View style={styles.inputShell}>
              <TextInput
                ref={nameInputRef}
                accessibilityLabel="PDF name"
                onBlur={() => setNameFieldFocused(false)}
                onChangeText={value => {
                  setEditingFileName(value);
                  setSelectionStart(value.length);
                }}
                onFocus={() => setNameFieldFocused(true)}
                onSelectionChange={event =>
                  setSelectionStart(event.nativeEvent.selection.start)
                }
                onSubmitEditing={() => onSaveFile(editingFileName.trim())}
                placeholder="PDF name"
                caretHidden={false}
                cursorColor="#000000"
                selectionColor="#000000"
                style={[
                  styles.fileNameInput,
                  nameFieldFocused && styles.fileNameInputFocused,
                ]}
                value={editingFileName}
              />
              {nameFieldFocused ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.customCaret,
                    {left: 12 + caretTextWidth, opacity: caretVisible ? 1 : 0},
                  ]}
                />
              ) : null}
              <Text
                onLayout={event => setCaretTextWidth(event.nativeEvent.layout.width)}
                style={styles.caretMeasure}>
                {editingFileName.slice(0, selectionStart)}
              </Text>
            </View>
            <Text style={styles.fileExtension}>.pdf</Text>
          </View>
        ) : null}
      </Animated.View>
      <Animated.View
        pointerEvents="auto"
        style={[styles.sidebarLayer, {transform: [{translateX: sidebarOffset}]}]}>
        <SidebarRail
          fileName={fileName}
          tabs={tabs}
          activeTabId={activeTabId}
          logoSource={logoSource}
          onSelectFile={onSelectFile}
          onSelectTab={onSelectTab}
          onCloseTab={onCloseTab}
          onClearFile={onClearFile}
          onDetectForms={onDetectForms}
          formsDetectLabel={formsDetectLabel}
          formsDetectDisabled={formsDetectDisabled}
          formFieldCount={formFieldCount}
        />
        <Pressable
          accessibilityLabel={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          accessibilityRole="button"
          onPress={toggleSidebar}
          onHoverIn={() => setToggleHover(true)}
          onHoverOut={() => setToggleHover(false)}
          style={({pressed}) => [
            styles.revealButton,
            toggleHovered && styles.toggleHovered,
          ]}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.toggleHoverFill,
              {
                opacity: toggleHoverProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              },
            ]}
          />
          <Text style={styles.revealLabel}>{sidebarVisible ? '‹' : '›'}</Text>
        </Pressable>
      </Animated.View>
    </KeyboardSurface>
  );
}

const styles = StyleSheet.create({
  window: {
    flex: 1,
    position: 'relative',
    backgroundColor: theme.windowBg,
  },
  stage: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.stageBg,
    overflow: 'hidden',
  },
  readerLayer: {
    flex: 1,
  },
  documentStage: {
    flex: 1,
    position: 'relative',
  },
  pdfLayer: {
    flex: 1,
  },
  gutterOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingRight: STAGE_SCROLLBAR_WIDTH,
  },
  pdfColumnSpacer: {
    flexGrow: 0,
    flexShrink: 1,
    width: PDF_COLUMN_MAX_WIDTH,
    maxWidth: PDF_COLUMN_MAX_WIDTH,
    pointerEvents: 'none',
  },
  revealButton: {
    position: 'absolute',
    left: RAIL_WIDTH + 10,
    bottom: 12,
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#8BB5F2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 3},
    zIndex: 30,
    overflow: 'hidden',
  },
  sidebarLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: RAIL_WIDTH,
    zIndex: 10,
  },
  fileNameBar: {
    position: 'absolute',
    right: 16,
    bottom: 12,
    maxWidth: 360,
    minWidth: 180,
    zIndex: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fileNameInput: {
    color: theme.textPrimary,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderColor: '#A1A1A6',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    minHeight: 30,
    flex: 1,
    width: '100%',
  },
  inputShell: {
    flex: 1,
    position: 'relative',
  },
  fileNameInputFocused: {
    borderColor: theme.accent,
    borderWidth: 1,
  },
  fileExtension: {
    color: theme.textSecondary,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    fontSize: 13,
    minHeight: 30,
    paddingRight: 8,
    paddingVertical: 6,
    marginLeft: -4,
  },
  caretMeasure: {
    position: 'absolute',
    left: 10,
    top: 7,
    opacity: 0,
    color: theme.textPrimary,
    fontSize: 13,
  },
  customCaret: {
    position: 'absolute',
    top: 7,
    width: 1,
    height: 17,
    backgroundColor: '#000000',
  },
  revealLabel: {
    color: theme.accent,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: -1,
  },
  toggleHoverFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(45, 127, 249, 0.24)',
  },
  toggleHovered: {
    borderColor: '#4B91E7',
    backgroundColor: '#EAF3FF',
  },
  pressed: {
    opacity: 0.85,
  },
});
