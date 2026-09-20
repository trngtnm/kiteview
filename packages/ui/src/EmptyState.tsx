import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {SelectFileButton} from './SelectFileButton';
import {useTheme} from './ThemeProvider';
import type {Theme} from './theme';

type EmptyStateProps = {
  onSelectFile: () => void;
};

export function EmptyState({onSelectFile}: EmptyStateProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>KiteView</Text>
      <Text style={styles.subtitle}>
        Open a PDF to start reading. Side margins are reserved for AI notes later.
      </Text>
      <SelectFileButton onPress={onSelectFile} style={styles.cta} />
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 48,
      backgroundColor: theme.stageBg,
    },
    brand: {
      color: theme.textPrimary,
      fontSize: 36,
      fontWeight: '700',
      letterSpacing: -0.8,
      marginBottom: 12,
    },
    subtitle: {
      color: theme.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      maxWidth: 360,
      marginBottom: 28,
    },
    cta: {
      minWidth: 160,
    },
  });
}
