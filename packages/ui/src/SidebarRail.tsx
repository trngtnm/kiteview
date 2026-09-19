import React, {useRef, useState} from 'react';
import {
  Animated,
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
  onDetectForms?: () => void;
  formsDetectLabel?: string;
  formsDetectDisabled?: boolean;
  formFieldCount?: number;
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
  onDetectForms,
  formsDetectLabel = 'Detect forms',
  formsDetectDisabled,
  formFieldCount,
}: SidebarRailProps) {
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);
  const [detectHovered, setDetectHovered] = useState(false);
  const detectHoverProgress = useRef(new Animated.Value(0)).current;

  const setDetectHover = (value: boolean) => {
    setDetectHovered(value);
    Animated.timing(detectHoverProgress, {
      toValue: value ? 1 : 0,
      duration: value ? 650 : 450,
      useNativeDriver: true,
    }).start();
  };

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
                onHoverIn={() => setHoveredTabId(tab.id)}
                onHoverOut={() => setHoveredTabId(null)}
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

        {tabs.length > 0 && onDetectForms ? (
          <View style={styles.formsBlock}>
            <Text style={styles.section}>Forms</Text>
            <Pressable
              accessibilityRole="button"
              disabled={formsDetectDisabled}
              onPress={onDetectForms}
              onHoverIn={() => setDetectHover(true)}
              onHoverOut={() => setDetectHover(false)}
              style={({pressed}) => [
                styles.detectButton,
                formsDetectDisabled && styles.detectDisabled,
                detectHovered && !formsDetectDisabled && styles.hovered,
              ]}>
              <Animated.View
                pointerEvents="none"
                style={[styles.hoverFill, {opacity: detectHoverProgress}]}
              />
              <Text style={styles.detectLabel}>{formsDetectLabel}</Text>
            </Pressable>
            {typeof formFieldCount === 'number' ? (
              <Text style={styles.formsMeta}>
                {formFieldCount} field{formFieldCount === 1 ? '' : 's'} found
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: RAIL_WIDTH,
    height: '100%',
    backgroundColor: '#FDFEFF',
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.railBorder,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: {width: 4, height: 0},
  },
  header: {
    backgroundColor: '#F7FAFE',
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 16,
    alignItems: 'center',
  },
  logo: {
    width: 188,
    height: 105,
  },
  body: {
    paddingTop: 22,
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: '#F7FAFE',
    borderTopWidth: 1,
    borderTopColor: '#F0F3F7',
  },
  section: {
    color: '#69778B',
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
    color: '#8995A6',
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
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF4FB',
    borderWidth: 1,
    borderColor: '#E4E9F0',
  },
  activeTab: {
    backgroundColor: '#DCEBFC',
    borderColor: '#B7D2FA',
  },
  tabName: {
    flex: 1,
    color: '#26364B',
    fontSize: 12,
    lineHeight: 16,
  },
  tabClose: {
    color: '#77859A',
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
  formsBlock: {
    marginTop: 28,
  },
  detectButton: {
    alignSelf: 'stretch',
    backgroundColor: '#367EDB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  detectDisabled: {
    opacity: 0.45,
  },
  hovered: {
    backgroundColor: '#4B91E7',
    borderColor: '#A8CBF8',
  },
  hoverFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
  },
  detectLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  formsMeta: {
    marginTop: 8,
    color: '#8E8E93',
    fontSize: 12,
  },
});
