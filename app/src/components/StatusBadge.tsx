import {useOriginalLabels} from '../core/localization/original';
import {useColors} from '../core/theme/useTheme';
import {CareText as Text} from './CareText';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors as baseColors } from '../core/theme/colors';
import { useAccessibilityStore } from '../core/accessibility/useAccessibilityStore';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface Props {
  label: string;
  variant?: BadgeVariant;
  size?: 'small' | 'medium';
}

export const StatusBadge: React.FC<Props> = ({ label, variant = 'neutral', size = 'medium' }) => {
  const tr=useOriginalLabels();
  const colors=useColors();
  const styles=buildStyles(colors);

  const { fs } = useAccessibilityStore();

  const getStyles = () => {
    switch (variant) {
      case 'success':
        return {
          bg: colors.success,
          text: colors.successText,
          border: colors.successBorder,
        };
      case 'warning':
        return {
          bg: colors.warning,
          text: colors.warningText,
          border: colors.warningBorder,
        };
      case 'danger':
        return {
          bg: colors.danger,
          text: colors.dangerText,
          border: colors.dangerBorder,
        };
      case 'info':
        return {
          bg: colors.primaryLight,
          text: colors.primary,
          border: colors.borderLight,
        };
      default:
        return {
          bg: colors.surfaceWarm,
          text: colors.textSecondary,
          border: colors.border,
        };
    }
  };

  const current = getStyles();
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: current.bg,
          borderColor: current.border,
          paddingVertical: isSmall ? 4 : 6,
          paddingHorizontal: isSmall ? 8 : 12,
        },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          {
            color: current.text,
            fontSize: fs(isSmall ? 11 : 12.5),
          },
        ]}
      >
        {tr(label)}
      </Text>
    </View>
  );
};

const buildStyles = (colors: typeof baseColors) => StyleSheet.create({
  badge: {
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  badgeText: {
    fontWeight: '700',
    letterSpacing: 0.2,
    flexShrink: 1,
    textAlign: 'center',
  },
});
