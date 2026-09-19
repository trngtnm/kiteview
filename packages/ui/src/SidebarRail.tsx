import React from 'react';
import {Image, ImageSourcePropType, StyleSheet, Text, View} from 'react-native';
import {SelectFileButton} from './SelectFileButton';
import {RAIL_WIDTH, theme} from './theme';

type SidebarRailProps = {
  fileName?: string | null;
  logoSource: ImageSourcePropType;
  onSelectFile: () => void;
  onClearFile?: () => void;
};

export function SidebarRail({
  fileName,
  logoSource,
  onSelectFile,
  onClearFile,
}: SidebarRailProps) {
  return (
    <View style={styles.rail}>
      <View style={styles.header}>
        <Image
          accessibilityLabel="KiteView"
          resizeMode="contain"
          source={logoSource}
          style={styles.logo}
        />
      </View>
      <View style={styles.body}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: RAIL_WIDTH,
    backgroundColor: theme.railBg,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.railBorder,
  },
  header: {
    backgroundColor: theme.railBg,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.railBorder,
    alignItems: 'center',
  },
  logo: {
    width: 188,
    height: 105,
  },
  body: {
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 20,
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
