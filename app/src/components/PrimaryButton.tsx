import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors } from '../core/theme/colors';
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
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { fontSize: fs(16) }, textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
