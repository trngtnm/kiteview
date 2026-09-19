import React from 'react';
import {StyleSheet, View} from 'react-native';
import {EmptyState} from './EmptyState';
import {GutterSlot} from './GutterSlot';
import {SidebarRail} from './SidebarRail';
import {PDF_COLUMN_MAX_WIDTH, theme} from './theme';

type ReaderShellProps = {
  fileName?: string | null;
  onSelectFile: () => void;
  onClearFile?: () => void;
  children?: React.ReactNode;
};

/**
 * Fora-inspired reader chrome:
 * fixed left rail + main stage with centered column and empty side gutters
 * (reserved for future AI annotations / comments / descriptions).
 */
export function ReaderShell({
  fileName,
  onSelectFile,
  onClearFile,
  children,
}: ReaderShellProps) {
  const hasDocument = Boolean(children);

  return (
    <View style={styles.window}>
      <SidebarRail
        fileName={fileName}
        onSelectFile={onSelectFile}
        onClearFile={onClearFile}
      />
      <View style={styles.stage}>
        {hasDocument ? (
          <View style={styles.row}>
            <GutterSlot side="left" />
            <View style={styles.pdfColumn}>{children}</View>
            <GutterSlot side="right" />
          </View>
        ) : (
          <EmptyState onSelectFile={onSelectFile} />
        )}
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
  row: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  pdfColumn: {
    flexGrow: 0,
    flexShrink: 1,
    width: PDF_COLUMN_MAX_WIDTH,
    maxWidth: PDF_COLUMN_MAX_WIDTH,
    backgroundColor: theme.pageSurface,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 2},
  },
});
