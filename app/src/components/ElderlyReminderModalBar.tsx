import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, shadows } from '../core/theme/colors';
import { useAccessibilityStore } from '../core/accessibility/useAccessibilityStore';
import type { DueReminderItem } from '../core/routines/useElderlyReminderEngine';

interface Props {
  reminder: DueReminderItem;
  extraDueCount?: number;
  isConfirming?: boolean;
  isMuted?: boolean;
  onConfirm: (reminder: DueReminderItem) => void;
  onToggleMute?: () => void;
}

export const ElderlyReminderModalBar: React.FC<Props> = ({
  reminder,
  extraDueCount = 0,
  isConfirming = false,
  isMuted = false,
  onConfirm,
  onToggleMute,
}) => {
  const { fs } = useAccessibilityStore();

  const accent =
    reminder.kind === 'WATER'
      ? { bg: '#EAF4FB', border: '#93C5FD', iconBg: '#0284C7', titleColor: '#0C4A6E' }
      : reminder.kind === 'SLEEP'
        ? { bg: '#EEF0FB', border: '#A5B4FC', iconBg: '#4F46E5', titleColor: '#312E81' }
        : { bg: '#FEF3E7', border: '#F59E0B', iconBg: '#D97706', titleColor: '#78350F' };

  const renderIcon = () => {
    if (reminder.kind === 'WATER') {
      return <Feather name="droplet" size={20} color="#FFFFFF" />;
    }
    if (reminder.kind === 'SLEEP') {
      return <Feather name="moon" size={20} color="#FFFFFF" />;
    }
    return <MaterialCommunityIcons name="pill" size={21} color="#FFFFFF" />;
  };

  return (
    <View
      style={[
        styles.barContainer,
        { backgroundColor: accent.bg, borderColor: accent.border },
      ]}
      accessibilityRole="alert"
    >
      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: accent.iconBg }]}>
          {renderIcon()}
        </View>

        <View style={styles.textCol}>
          <View style={styles.titleRow}>
            <Feather
              name={isMuted ? 'bell-off' : 'bell'}
              size={14}
              color={accent.titleColor}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.titleText, { color: accent.titleColor, fontSize: fs(13) }]}>
              {reminder.title} • {reminder.scheduledTime}
            </Text>
          </View>
          <Text style={[styles.subtitleText, { fontSize: fs(13.5) }]} numberOfLines={2}>
            {reminder.subtitle}
          </Text>
          {extraDueCount > 0 && (
            <Text style={[styles.extraText, { fontSize: fs(11.5) }]}>
              Còn {extraDueCount} lời nhắc đến giờ khác đang chờ
            </Text>
          )}
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
          onPress={() => onConfirm(reminder)}
          disabled={isConfirming}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={reminder.confirmLabel}
        >
          {isConfirming ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.confirmBtnInner}>
              <Feather name="check-circle" size={18} color="#FFFFFF" style={{ marginRight: 7 }} />
              <Text style={[styles.confirmBtnText, { fontSize: fs(15) }]}>
                {reminder.confirmLabel}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {onToggleMute && (
          <TouchableOpacity
            style={styles.muteBtn}
            onPress={onToggleMute}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={isMuted ? 'Bật chuông' : 'Tắt chuông'}
          >
            <Feather
              name={isMuted ? 'volume-2' : 'volume-x'}
              size={16}
              color={colors.textPrimary}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.muteBtnText, { fontSize: fs(12.5) }]}>
              {isMuted ? 'Bật chuông' : 'Tắt chuông'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  barContainer: {
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 6,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    ...shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  titleText: {
    fontWeight: '900',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  subtitleText: {
    color: colors.textPrimary,
    fontWeight: '700',
    lineHeight: 19,
  },
  extraText: {
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  muteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  muteBtnText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
