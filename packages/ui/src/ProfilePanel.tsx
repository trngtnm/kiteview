import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTheme} from './ThemeProvider';
import type {Theme} from './theme';

type ProfilePanelProps = {
  email?: string | null;
  displayName?: string | null;
  signedIn: boolean;
  onSignOut?: () => void;
  onOpenAuth?: () => void;
  onOpenPreferences?: () => void;
  onClose: () => void;
};

export function ProfilePanel({
  email,
  displayName,
  signedIn,
  onSignOut,
  onOpenAuth,
  onOpenPreferences,
  onClose,
}: ProfilePanelProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const titleName = displayName?.trim() || email?.split('@')[0] || 'Guest';

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.card} accessibilityLabel="Profile">
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close profile"
            onPress={onClose}
            style={styles.close}>
            <Text style={styles.closeLabel}>✕</Text>
          </Pressable>
        </View>

        {signedIn ? (
          <>
            <Text style={styles.name}>{titleName}</Text>
            {email ? <Text style={styles.email}>{email}</Text> : null}
            <Text style={styles.meta}>
              Signed in. Reading preferences shape Explain and Summarize.
            </Text>
            {onOpenPreferences ? (
              <Pressable
                accessibilityRole="button"
                onPress={onOpenPreferences}
                style={styles.secondary}>
                <Text style={styles.secondaryLabel}>Reading preferences</Text>
              </Pressable>
            ) : null}
            {onSignOut ? (
              <Pressable
                accessibilityRole="button"
                onPress={onSignOut}
                style={styles.danger}>
                <Text style={styles.dangerLabel}>Sign out</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.name}>Guest</Text>
            <Text style={styles.meta}>
              Sign in to save reading preferences and sync your profile across
              sessions.
            </Text>
            {onOpenAuth ? (
              <Pressable
                accessibilityRole="button"
                onPress={onOpenAuth}
                style={styles.primary}>
                <Text style={styles.primaryLabel}>Sign in</Text>
              </Pressable>
            ) : null}
            {onOpenPreferences ? (
              <Pressable
                accessibilityRole="button"
                onPress={onOpenPreferences}
                style={styles.secondary}>
                <Text style={styles.secondaryLabel}>Reading preferences</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    wrapper: {
      alignSelf: 'flex-start',
      width: '100%',
      maxWidth: 340,
      paddingTop: 12,
      paddingHorizontal: 10,
    },
    card: {
      width: '100%',
      maxWidth: 320,
      padding: 14,
      borderRadius: 12,
      backgroundColor: theme.pageSurface,
      shadowColor: theme.shadow,
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: {width: 0, height: 2},
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    title: {
      flex: 1,
      color: theme.textPrimary,
      fontSize: 17,
      fontWeight: '700',
    },
    close: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.chipBg,
    },
    closeLabel: {color: theme.textSecondary, fontSize: 13, fontWeight: '600'},
    name: {
      marginTop: 12,
      color: theme.textPrimary,
      fontSize: 18,
      fontWeight: '700',
    },
    email: {
      marginTop: 4,
      color: theme.textSecondary,
      fontSize: 13,
    },
    meta: {
      marginTop: 10,
      marginBottom: 12,
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    primary: {
      backgroundColor: theme.accent,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
      marginBottom: 8,
    },
    primaryLabel: {color: theme.accentText, fontSize: 14, fontWeight: '700'},
    secondary: {
      backgroundColor: theme.chipBg,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
      marginBottom: 8,
    },
    secondaryLabel: {
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    danger: {
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.danger,
    },
    dangerLabel: {color: theme.danger, fontSize: 14, fontWeight: '700'},
  });
}
