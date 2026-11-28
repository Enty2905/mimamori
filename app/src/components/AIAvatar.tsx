import {useColors} from '../core/theme/useTheme';
import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { colors as baseColors } from '../core/theme/colors';

interface Props {
  size?: number;
  showOnlineStatus?: boolean;
}

export const AIAvatar: React.FC<Props> = ({ size = 48, showOnlineStatus = true }) => {
  const colors=useColors();
  const styles=buildStyles(colors);

  const isLarge = size >= 60;
  const iconSize = Math.round(size * 0.65);

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.surfaceWarm,
            borderColor: colors.primary,
          },
        ]}
      >
        <Image
          source={require('../../assets/images/mimamori-leaf-icon.png')}
          style={{ width: iconSize, height: iconSize }}
          resizeMode="contain"
        />
      </View>
      {showOnlineStatus && (
        <View
          style={[
            styles.onlineDot,
            {
              width: isLarge ? 14 : 10,
              height: isLarge ? 14 : 10,
              borderRadius: isLarge ? 7 : 5,
              bottom: 1,
              right: 1,
            },
          ]}
        />
      )}
    </View>
  );
};

const buildStyles = (colors: typeof baseColors) => StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  onlineDot: {
    position: 'absolute',
    backgroundColor: colors.background === baseColors.background ? '#326847' : colors.surfaceWarm,
    borderWidth: 2,
    borderColor: colors.background === baseColors.background ? '#FFFFFF' : colors.border,
  },
});
