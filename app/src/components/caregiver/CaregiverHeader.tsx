import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, shadows } from '../../core/theme/colors';
import { useAccessibilityStore } from '../../core/accessibility/useAccessibilityStore';

export interface CaregiverHeaderProps {
  title: string;
  subtitle?: string;
  lastUpdated?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  rightSlot?: React.ReactNode;
}

export const CaregiverHeader: React.FC<CaregiverHeaderProps> = ({
  title,
  subtitle,
  lastUpdated,
  onRefresh,
  refreshing = false,
  rightSlot,
}) => {
  const { fs } = useAccessibilityStore();

  return (
    <View style={styles.container}>
      <View style={styles.leftColumn}>
        <View style={styles.brandRow}>
          <View style={styles.brandPill}>
            <Image
              source={require('../../../assets/images/mimamori-leaf-icon.png')}
              style={styles.leafIcon}
              resizeMode="contain"
            />
            <Text style={[styles.brandText, { fontSize: fs(11) }]}>MIMAMORI</Text>
          </View>
          {Boolean(lastUpdated) && (
            <Text style={[styles.updatedText, { fontSize: fs(11.5) }]} numberOfLines={1}>
              {lastUpdated}
            </Text>
          )}
        </View>

        <Text style={[styles.title, { fontSize: fs(22) }]}>{title}</Text>

        {Boolean(subtitle) && (
          <Text style={[styles.subtitle, { fontSize: fs(13.5) }]}>{subtitle}</Text>
        )}
      </View>

      {(rightSlot || onRefresh) && (
        <View style={styles.rightActions}>
          {rightSlot}
          {onRefresh && (
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={onRefresh}
              disabled={refreshing}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Làm mới dữ liệu"
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="refresh-cw" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: colors.background,
    gap: 12,
  },
  leftColumn: {
    flex: 1,
    minWidth: 0,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 5,
  },
  leafIcon: {
    width: 14,
    height: 14,
  },
  brandText: {
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.6,
  },
  updatedText: {
    color: colors.textMuted,
    fontWeight: '500',
    flexShrink: 1,
  },
  title: {
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 29,
    flexShrink: 1,
  },
  subtitle: {
    color: colors.textSecondary,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 3,
    flexShrink: 1,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    paddingTop: 2,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
});
