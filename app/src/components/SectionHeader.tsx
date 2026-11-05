import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../core/theme/colors';
import { useAccessibilityStore } from '../core/accessibility/useAccessibilityStore';

interface Props {
  title: string;
  subtitle?: string;
  actionText?: string;
  onAction?: () => void;
  kanjiSubtitle?: string; // Optional backwards compatibility
}

export const SectionHeader: React.FC<Props> = ({
  title,
  subtitle,
  actionText,
  onAction,
}) => {
  const { fs } = useAccessibilityStore();

  return (
    <View style={styles.container}>
      <View style={styles.leftCol}>
        <View style={styles.titleRow}>
          <View style={styles.accentBar} />
          <Text style={[styles.title, { fontSize: fs(18) }]}>{title}</Text>
        </View>
        {subtitle && <Text style={[styles.subtitle, { fontSize: fs(13) }]}>{subtitle}</Text>}
      </View>

      {actionText && onAction && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onAction}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Text style={[styles.actionText, { fontSize: fs(14) }]}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
    marginTop: 8,
  },
  leftCol: {
    flex: 1,
    paddingRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accentBar: {
    width: 4,
    height: 18,
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginRight: 8,
  },
  title: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: 2,
    marginLeft: 12,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  actionText: {
    fontWeight: '700',
    color: colors.primary,
  },
});
