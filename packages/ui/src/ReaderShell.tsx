import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  ImageSourcePropType,
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
  /** Content for the left gutter (e.g. definition panel). */
  leftGutter?: React.ReactNode;
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
  leftGutter,
  children,
}: ReaderShellProps) {
  const hasDocument = Boolean(children);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [nameFieldFocused, setNameFieldFocused] = useState(false);
  const [editingFileName, setEditingFileName] = useState(
    fileName?.replace(/\.pdf$/i, '') ?? '',
  );
  const sidebarOffset = useRef(new Animated.Value(0)).current;
  const readerOffset = sidebarOffset.interpolate({
    inputRange: [-RAIL_WIDTH, 0],
    outputRange: [0, RAIL_WIDTH / 2],
  });

  useEffect(() => {
    setEditingFileName(fileName?.replace(/\.pdf$/i, '') ?? '');
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

  const toggleSidebar = () => {
    setSidebarVisible(visible => !visible);
  };

  return (
    <KeyboardSurface
      style={styles.window}
      onKeyDown={(event: any) => {
        if ((event.metaKey || event.ctrlKey) && event.key?.toLowerCase() === 's') {
          event.preventDefault?.();
          onSaveFile(editingFileName.trim());
        }
      }}>
      <View style={styles.stage}>
        <Animated.View
          style={[styles.readerLayer, {transform: [{translateX: readerOffset}]}]}>
          {hasDocument ? (
            <View style={styles.documentStage}>
              <View style={styles.pdfLayer}>{children}</View>
              <View style={styles.gutterOverlay} pointerEvents="box-none">
                <GutterSlot side="left">{leftGutter}</GutterSlot>
                <View style={styles.pdfColumnSpacer} />
                <GutterSlot side="right" />
              </View>
            </View>
          ) : (
            <EmptyState onSelectFile={onSelectFile} />
          )}
        </Animated.View>
        {fileName ? (
          <View style={styles.fileNameBar}>
            <TextInput
              accessibilityLabel="PDF name"
              onBlur={() => setNameFieldFocused(false)}
              onChangeText={value => setEditingFileName(value)}
              onFocus={() => setNameFieldFocused(true)}
              onSubmitEditing={() => onSaveFile(editingFileName.trim())}
              placeholder="PDF name"
              caretHidden={false}
              cursorColor="#000000"
              selectionColor="#B9D9FF"
              style={[
                styles.fileNameInput,
                nameFieldFocused && styles.fileNameInputFocused,
              ]}
              value={editingFileName}
            />
            <Text style={styles.fileExtension}>.pdf</Text>
          </View>
        ) : null}
      </View>
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
        />
        <Pressable
          accessibilityLabel={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          accessibilityRole="button"
          onPress={toggleSidebar}
          style={({pressed}) => [
            styles.revealButton,
            pressed && styles.pressed,
          ]}>
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
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.stageBg,
    overflow: 'hidden',
  },
  readerLayer: {
    ...StyleSheet.absoluteFillObject,
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
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.railBg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
    zIndex: 30,
  },
  sidebarLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: RAIL_WIDTH,
    backgroundColor: theme.railBg,
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
    backgroundColor: '#FFFFFF',
    borderColor: '#A1A1A6',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    minHeight: 30,
    flex: 1,
  },
  fileNameInputFocused: {
    borderColor: '#FF8A00',
    borderWidth: 2,
  },
  fileExtension: {
    color: theme.textSecondary,
    backgroundColor: '#FFFFFF',
    fontSize: 13,
    minHeight: 30,
    paddingRight: 8,
    paddingVertical: 6,
    marginLeft: -4,
  },
  revealLabel: {
    color: '#F5F5F7',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: -1,
  },
  pressed: {
    opacity: 0.85,
  },
});
