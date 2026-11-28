import {useOriginalLabels} from '../core/localization/original';
import {useColors} from '../core/theme/useTheme';
import {CareText as Text} from './CareText';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors as baseColors } from '../core/theme/colors';
import { PrimaryButton } from './PrimaryButton';
import { useAccessibilityStore } from '../core/accessibility/useAccessibilityStore';

interface Props {
  icon?: string;
  vectorIcon?: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<Props> = ({
  icon,
  vectorIcon = 'inbox',
  title,
  description,
  actionText,
  onAction,
}) => {
  const tr=useOriginalLabels();
  const colors=useColors();
  const styles=buildStyles(colors);

  const { fs } = useAccessibilityStore();

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        {vectorIcon ? (
          <Feather name={vectorIcon} size={28} color={colors.primary} />
        ) : (
          <Text style={styles.icon}>{icon}</Text>
        )}
      </View>
      <Text style={[styles.title, { fontSize: fs(20) }]}>{tr(title)}</Text>
      <Text style={[styles.description, { fontSize: fs(13.5) }]}>{tr(description)}</Text>
      {actionText && onAction && (
        <PrimaryButton
          title={tr(actionText)}
          onPress={onAction}
          style={styles.actionBtn}
        />
      )}
    </View>
  );
};

const buildStyles = (colors: typeof baseColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  description: {
    color: colors.textSecondary,
    textAlign: 'center',

    marginBottom: 18,
  },
  actionBtn: {
    width: '100%',
  },
});
