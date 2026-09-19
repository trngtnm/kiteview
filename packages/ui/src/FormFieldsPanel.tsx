import React from 'react';
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
import {theme} from './theme';

type FormFieldsPanelProps = {
  status: FormAnalysisStatus;
  fields: DetectedFormField[];
  selectedFieldId: string | null;
  error: string | null;
  onSelectField: (id: string) => void;
};

const TYPE_LABEL: Record<DetectedFormField['type'], string> = {
  text: 'Text',
  checkbox: 'Checkbox',
  radio: 'Radio',
  dropdown: 'Dropdown',
  signature: 'Signature',
  unknown: 'Field',
};

export function FormFieldsPanel({
  status,
  fields,
  selectedFieldId,
  error,
  onSelectField,
}: FormFieldsPanelProps) {
  if (status === 'idle') {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Text style={styles.title}>Form fields</Text>

        {status === 'loading' ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.accent} />
            <Text style={styles.meta}>Scanning for form fields…</Text>
          </View>
        ) : null}

        {status === 'error' ? (
          <Text style={styles.error}>{error || 'Could not analyze form.'}</Text>
        ) : null}

        {status === 'none' ? (
          <Text style={styles.meta}>No fillable form fields found</Text>
        ) : null}

        {status === 'ready' || fields.length > 0 ? (
          <>
            <Text style={styles.count}>
              {fields.length} field{fields.length === 1 ? '' : 's'} detected
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
                        p.{field.pageNumber} · {TYPE_LABEL[field.type]}
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

const styles = StyleSheet.create({
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
    shadowColor: '#000',
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
    color: '#C62828',
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
    backgroundColor: '#F5F5F7',
  },
  rowSelected: {
    backgroundColor: 'rgba(0, 113, 227, 0.12)',
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
