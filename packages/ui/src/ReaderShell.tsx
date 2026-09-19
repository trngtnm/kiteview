import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {EmptyState} from './EmptyState';
import {GutterSlot} from './GutterSlot';
import {SidebarRail} from './SidebarRail';
import {PDF_COLUMN_MAX_WIDTH, STAGE_SCROLLBAR_WIDTH, theme} from './theme';

type ReaderShellProps = {
  fileName?: string | null;
  onSelectFile: () => void;
  onClearFile?: () => void;
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
  onSelectFile,
  onClearFile,
  leftGutter,
  children,
}: ReaderShellProps) {
  const hasDocument = Boolean(children);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  return (
    <View style={styles.window}>
      {sidebarVisible ? (
        <SidebarRail
          fileName={fileName}
          onSelectFile={onSelectFile}
          onClearFile={onClearFile}
        />
      ) : null}
      <View style={styles.stage}>
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
        <Pressable
          accessibilityLabel={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          accessibilityRole="button"
          onPress={() => setSidebarVisible(visible => !visible)}
          style={({pressed}) => [styles.revealButton, pressed && styles.pressed]}>
          <Text style={styles.revealLabel}>{sidebarVisible ? '‹' : '›'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  window: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.windowBg,
  },
  stage: {
    flex: 1,
    backgroundColor: theme.stageBg,
    overflow: 'hidden',
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
    left: 10,
    top: 12,
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
    zIndex: 20,
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
