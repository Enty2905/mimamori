import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../core/theme/colors';
import { useAccessibilityStore } from '../core/accessibility/useAccessibilityStore';

interface Props {
  userName?: string;
  onPressProfile?: () => void;
  rightAction?: React.ReactNode;
}

export const AppHeader: React.FC<Props> = ({ userName = 'Bác', onPressProfile, rightAction }) => {
  const { fs } = useAccessibilityStore();

  const todayFormatted = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const getInitials = (name: string) => {
    if (!name) return 'M';
    const parts = name.trim().split(' ');
    return parts[parts.length - 1]?.charAt(0).toUpperCase() || 'M';
  };

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <View style={styles.kickerRow}>
          <View style={styles.brandBadge}>
            <Text style={[styles.brandBadgeText, { fontSize: fs(11) }]}>MIMAMORI</Text>
          </View>
          <Text style={[styles.dateText, { fontSize: fs(13) }]}>{todayFormatted}</Text>
        </View>
        <Text style={[styles.greetingTitle, { fontSize: fs(22) }]}>
          Kính chào cụ <Text style={styles.highlightName}>{userName}</Text>
        </Text>
      </View>

      <View style={styles.rightGroup}>
        {rightAction ? (
          rightAction
        ) : (
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={onPressProfile}
            activeOpacity={0.8}
            accessibilityLabel="Hồ sơ cá nhân"
            accessibilityRole="button"
          >
            <Text style={[styles.avatarText, { fontSize: fs(18) }]}>{getInitials(userName)}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: colors.background,
  },
  textContainer: {
    flex: 1,
    paddingRight: 12,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  brandBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  brandBadgeText: {
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  dateText: {
    color: colors.textSecondary,
    fontWeight: '500',
    flexShrink: 1,
  },
  greetingTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 28,
  },
  highlightName: {
    color: colors.primary,
  },
  rightGroup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '800',
    color: colors.primary,
  },
});
