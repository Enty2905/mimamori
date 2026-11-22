import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors as lightColors, shadows } from '../../core/theme/colors';
import { useCaregiverTheme } from '../../core/accessibility/useAccessibilityStore';

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
  const { isDark, c: colors, fs, setCaregiverDarkMode } = useCaregiverTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

        <Text
          style={[
            styles.title,
            { fontSize: fs(22), lineHeight: Math.round(fs(22) * 1.32) },
          ]}
        >
          {title}
        </Text>

        {Boolean(subtitle) && (
          <Text
            style={[
              styles.subtitle,
              { fontSize: fs(13.5), lineHeight: Math.round(fs(13.5) * 1.45) },
            ]}
          >
            {subtitle}
          </Text>
        )}
      </View>

      <View style={styles.rightActions}>
        {rightSlot}
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => void setCaregiverDarkMode(!isDark)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang chế độ ban đêm'}
        >
          <Feather
            name={isDark ? 'sun' : 'moon'}
            size={18}
            color={isDark ? colors.accentDark : colors.primary}
          />
        </TouchableOpacity>
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
    </View>
  );
};

const createStyles = (colors: typeof lightColors) => StyleSheet.create({
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
    flexShrink: 1,
  },
  subtitle: {
    color: colors.textSecondary,
    fontWeight: '500',
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
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
});
