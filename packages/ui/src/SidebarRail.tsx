import React, {useMemo, useRef, useState} from 'react';
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
import {useTheme} from './ThemeProvider';
import {RAIL_WIDTH, type Theme} from './theme';

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
  accountLabel?: string;
  onOpenAccount?: () => void;
  onOpenPreferences?: () => void;
  onSignOut?: () => void;
  colorScheme?: 'light' | 'dark';
  onToggleAppearance?: () => void;
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
  formsDetectLabel = 'Find form fields',
  formsDetectDisabled,
  formFieldCount,
  accountLabel = 'Guest',
  onOpenAccount,
  onOpenPreferences,
  onSignOut,
  colorScheme = 'light',
  onToggleAppearance,
}: SidebarRailProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
              style={[
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

        <View style={styles.bodySpacer} />

        {(onOpenAccount || onOpenPreferences || onToggleAppearance) && (
          <View style={styles.accountBlock}>
            <Text style={styles.section}>Account</Text>
            <Text style={styles.accountLabel} numberOfLines={1}>
              {accountLabel}
            </Text>
            {onOpenAccount ? (
              <Pressable
                accessibilityRole="button"
                onPress={onOpenAccount}
                style={({pressed}) => [
                  styles.accountButton,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.accountButtonLabel}>
                  {onSignOut ? 'Account' : 'Sign in'}
                </Text>
              </Pressable>
            ) : null}
            {onOpenPreferences ? (
              <Pressable
                accessibilityRole="button"
                onPress={onOpenPreferences}
                style={({pressed}) => [
                  styles.accountButton,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.accountButtonLabel}>Preferences</Text>
              </Pressable>
            ) : null}
            {onToggleAppearance ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  colorScheme === 'dark'
                    ? 'Switch to light mode'
                    : 'Switch to dark mode'
                }
                onPress={onToggleAppearance}
                style={({pressed}) => [
                  styles.accountButton,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.accountButtonLabel}>
                  {colorScheme === 'dark' ? 'Light mode' : 'Dark mode'}
                </Text>
              </Pressable>
            ) : null}
            {onSignOut ? (
              <Text style={styles.clear} onPress={onSignOut}>
                Sign out
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    rail: {
      width: RAIL_WIDTH,
      height: '100%',
      backgroundColor: theme.railBg,
      borderTopRightRadius: 18,
      borderBottomRightRadius: 18,
      overflow: 'hidden',
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: theme.railBorder,
      shadowColor: theme.shadow,
      shadowOpacity: 0.22,
      shadowRadius: 18,
      shadowOffset: {width: 4, height: 0},
    },
    header: {
      backgroundColor: theme.railHeaderBg,
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
      flex: 1,
      paddingTop: 22,
      paddingHorizontal: 16,
      paddingBottom: 20,
      backgroundColor: theme.railHeaderBg,
      borderTopWidth: 1,
      borderTopColor: theme.railBorder,
    },
    bodySpacer: {
      flex: 1,
      minHeight: 24,
    },
    section: {
      color: theme.textSecondary,
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
      color: theme.textSecondary,
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
      backgroundColor: theme.tabBg,
      borderWidth: 1,
      borderColor: theme.tabBorder,
    },
    activeTab: {
      backgroundColor: theme.tabBgActive,
      borderColor: theme.tabBorderActive,
    },
    tabName: {
      flex: 1,
      color: theme.textPrimary,
      fontSize: 12,
      lineHeight: 16,
    },
    tabClose: {
      color: theme.textSecondary,
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
      backgroundColor: theme.accent,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.accentBorder,
      paddingVertical: 10,
      paddingHorizontal: 12,
      alignItems: 'center',
      overflow: 'hidden',
    },
    detectDisabled: {
      opacity: 0.45,
    },
    hovered: {
      backgroundColor: theme.accentHover,
    },
    hoverFill: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.hoverFill,
    },
    detectLabel: {
      color: theme.accentText,
      fontSize: 13,
      fontWeight: '600',
    },
    formsMeta: {
      marginTop: 8,
      color: theme.textSecondary,
      fontSize: 12,
    },
    accountBlock: {
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.railBorder,
    },
    accountLabel: {
      color: theme.textPrimary,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 10,
    },
    accountButton: {
      alignSelf: 'stretch',
      backgroundColor: theme.tabBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.tabBorder,
      paddingVertical: 9,
      paddingHorizontal: 12,
      alignItems: 'center',
      marginBottom: 8,
    },
    accountButtonLabel: {
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
