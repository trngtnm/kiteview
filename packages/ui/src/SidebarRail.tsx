import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {SelectFileButton} from './SelectFileButton';
import {RAIL_WIDTH, theme} from './theme';

type SidebarRailProps = {
  fileName?: string | null;
  onSelectFile: () => void;
  onClearFile?: () => void;
};

export function SidebarRail({
  fileName,
  onSelectFile,
  onClearFile,
}: SidebarRailProps) {
  return (
    <View style={styles.rail}>
      <Text style={styles.brand}>KiteView</Text>
      <Text style={styles.section}>Library</Text>
      <SelectFileButton
        compact
        label="Open PDF"
        onPress={onSelectFile}
        style={styles.openButton}
      />
      {fileName ? (
        <View style={styles.fileBlock}>
          <Text style={styles.fileLabel}>Current</Text>
          <Text style={styles.fileName} numberOfLines={3}>
            {fileName}
          </Text>
          {onClearFile ? (
            <Text style={styles.clear} onPress={onClearFile}>
              Close
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.hint}>No document open</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: RAIL_WIDTH,
    backgroundColor: theme.railBg,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.railBorder,
    paddingTop: 28,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  brand: {
    color: '#F5F5F7',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 28,
  },
  section: {
    color: '#A1A1A6',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  openButton: {
    alignSelf: 'stretch',
  },
  hint: {
    marginTop: 16,
    color: '#8E8E93',
    fontSize: 12,
    lineHeight: 16,
  },
  fileBlock: {
    marginTop: 20,
  },
  fileLabel: {
    color: '#A1A1A6',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  fileName: {
    color: '#F5F5F7',
    fontSize: 13,
    lineHeight: 18,
  },
  clear: {
    marginTop: 10,
    color: theme.accent,
    fontSize: 13,
    fontWeight: '500',
  },
});
