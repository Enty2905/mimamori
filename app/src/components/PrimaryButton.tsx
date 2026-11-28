import {useOriginalLabels} from '../core/localization/original';
import {useColors} from '../core/theme/useTheme';
import {CareText as Text, CareTouchable as TouchableOpacity} from './CareText';
import React from 'react';
import {
      StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors as baseColors } from '../core/theme/colors';
import { useAccessibilityStore } from '../core/accessibility/useAccessibilityStore';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  variant?: 'primary' | 'success' | 'danger';
}

export const PrimaryButton: React.FC<Props> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  variant = 'primary',
}) => {
  const tr=useOriginalLabels();
  const colors=useColors();
  const styles=buildStyles(colors);

  const { fs } = useAccessibilityStore();

  const getBgColor = () => {
    if (disabled) return colors.border;
    switch (variant) {
      case 'success':
        return colors.successText;
      case 'danger':
        return colors.dangerText;
      default:
        return colors.primary;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: getBgColor() },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={colors.textInverse} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { fontSize: fs(20) }, textStyle]}>{tr(title)}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const buildStyles = (colors: typeof baseColors) => StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  text: {
    color: colors.textInverse,
    fontWeight: '700',
    letterSpacing: 0.3,
    flexShrink: 1,
    textAlign: 'center',
  },
});
