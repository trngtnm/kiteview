import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {DocumentTab} from '@kiteview/core';
import {SelectFileButton} from './SelectFileButton';
import {RAIL_WIDTH, theme} from './theme';

type SidebarRailProps = {
  fileName?: string | null;
  tabs: DocumentTab[];
  activeTabId: string | null;
  logoSource: ImageSourcePropType;
  onSelectFile: () => void;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onClearFile?: () => void;
};

export function SidebarRail({
  fileName,
  tabs,
  activeTabId,
  logoSource,
  onSelectFile,
  onSelectTab,
  onCloseTab,
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
        {tabs.length ? (
          <View style={styles.tabList}>
            {tabs.map(tab => (
              <Pressable
                accessibilityLabel={`Open ${tab.name}`}
                accessibilityRole="tab"
                key={tab.id}
                onPress={() => onSelectTab(tab.id)}
                style={({pressed}) => [
                  styles.tab,
                  tab.id === activeTabId && styles.activeTab,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.tabName} numberOfLines={2}>
                  {tab.name}
                </Text>
                <Text
                  accessibilityLabel={`Close ${tab.name}`}
                  accessibilityRole="button"
                  onPress={() => onCloseTab(tab.id)}
                  style={styles.tabClose}>
                  ×
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>No document open</Text>
        )}
        {fileName && onClearFile && tabs.length === 0 ? (
          <Text style={styles.clear} onPress={onClearFile}>
            Close
          </Text>
        ) : null}
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
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#6A6A70',
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
  tabList: {
    marginTop: 16,
    gap: 6,
  },
  tab: {
    minHeight: 42,
    paddingLeft: 10,
    paddingRight: 6,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#242426',
  },
  activeTab: {
    backgroundColor: '#454548',
  },
  tabName: {
    flex: 1,
    color: '#F5F5F7',
    fontSize: 12,
    lineHeight: 16,
  },
  tabClose: {
    color: '#A1A1A6',
    fontSize: 18,
    lineHeight: 20,
    paddingHorizontal: 5,
  },
  pressed: {
    opacity: 0.78,
  },
  clear: {
    marginTop: 10,
    color: theme.accent,
    fontSize: 13,
    fontWeight: '500',
  },
});
