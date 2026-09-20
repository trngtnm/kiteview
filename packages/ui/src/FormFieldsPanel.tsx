import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {DetectedFormField} from '@kiteview/pdf-engine';
import type {FormAnalysisStatus} from '@kiteview/core';
import {useTheme} from './ThemeProvider';
import type {Theme} from './theme';

type FormFieldsPanelProps = {
  status: FormAnalysisStatus;
  fields: DetectedFormField[];
  selectedFieldId: string | null;
  error: string | null;
  onSelectField: (id: string) => void;
};

export function FormFieldsPanel({
  status,
  fields,
  selectedFieldId,
  error,
  onSelectField,
}: FormFieldsPanelProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (status === 'idle') {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Text style={styles.title}>Text fields</Text>

        {status === 'loading' ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.accent} />
            <Text style={styles.meta}>Finding text fields…</Text>
          </View>
        ) : null}

        {status === 'error' ? (
          <Text style={styles.error}>{error || 'Could not analyze form.'}</Text>
        ) : null}

        {status === 'none' ? (
          <Text style={styles.meta}>No text fields found</Text>
        ) : null}

        {status === 'ready' || fields.length > 0 ? (
          <>
            <Text style={styles.count}>
              {fields.length} text field{fields.length === 1 ? '' : 's'}
              {status === 'loading' ? ' (refining…)' : ''}
            </Text>
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}>
              {fields.map(field => {
                const selected = field.id === selectedFieldId;
                return (
                  <Pressable
                    key={field.id}
                    accessibilityRole="button"
                    onPress={() => onSelectField(field.id)}
                    style={({pressed}) => [
                      styles.row,
                      selected && styles.rowSelected,
                      pressed && styles.rowPressed,
                    ]}>
                    <View style={styles.rowText}>
                      <Text style={styles.fieldName} numberOfLines={2}>
                        {field.name}
                      </Text>
                      <Text style={styles.fieldMeta}>
                        p.{field.pageNumber} · write area
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    wrapper: {
      alignSelf: 'stretch',
      width: '100%',
      paddingTop: 20,
      paddingHorizontal: 8,
      alignItems: 'stretch',
    },
    card: {
      alignSelf: 'stretch',
      width: '100%',
      maxWidth: '100%',
      padding: 14,
      borderRadius: 12,
      backgroundColor: theme.pageSurface,
      shadowColor: theme.shadow,
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: {width: 0, height: 2},
      maxHeight: 420,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.2,
      marginBottom: 8,
    },
    count: {
      color: theme.textSecondary,
      fontSize: 12,
      marginBottom: 8,
    },
    centered: {
      marginTop: 12,
      alignItems: 'center',
      gap: 8,
    },
    meta: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    error: {
      marginTop: 8,
      color: theme.danger,
      fontSize: 13,
      lineHeight: 18,
    },
    list: {
      maxHeight: 320,
    },
    listContent: {
      gap: 6,
      paddingBottom: 4,
    },
    row: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: theme.chipBg,
    },
    rowSelected: {
      backgroundColor: theme.tabBgActive,
    },
    rowPressed: {
      opacity: 0.85,
    },
    rowText: {
      gap: 2,
    },
    fieldName: {
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: '600',
    },
    fieldMeta: {
      color: theme.textSecondary,
      fontSize: 11,
    },
  });
}
