import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, Animated, Easing } from 'react-native';
import { colors } from '../core/theme/colors';

export type AIAvatarStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface Props {
  size?: number;
  showOnlineStatus?: boolean;
  status?: AIAvatarStatus;
}

const STATUS_DOT_COLOR: Record<AIAvatarStatus, string> = {
  idle: '#326847',
  listening: colors.dangerText,
  thinking: '#C77A1C',
  speaking: colors.primary,
  error: colors.dangerText,
};

export const AIAvatar: React.FC<Props> = ({
  size = 48,
  showOnlineStatus = true,
  status = 'idle',
}) => {
  const isLarge = size >= 60;
  const iconSize = Math.round(size * 0.65);

  const [ringScale] = useState(() => new Animated.Value(1));
  const [ringOpacity] = useState(() => new Animated.Value(0));
  const [avatarScale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    ringScale.stopAnimation();
    ringOpacity.stopAnimation();
    avatarScale.stopAnimation();

    if (status === 'idle' || status === 'error') {
      ringScale.setValue(1);
      ringOpacity.setValue(0);
      avatarScale.setValue(1);
      return;
    }

    if (status === 'listening') {
      ringScale.setValue(1);
      ringOpacity.setValue(0.55);
      avatarScale.setValue(1);

      const ringLoop = Animated.loop(
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1.34,
            duration: 1100,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 1100,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      const breatheLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(avatarScale, {
            toValue: 1.05,
            duration: 550,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(avatarScale, {
            toValue: 1,
            duration: 550,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      ringLoop.start();
      breatheLoop.start();

      return () => {
        ringLoop.stop();
        breatheLoop.stop();
      };
    }

    if (status === 'thinking') {
      ringScale.setValue(1.02);
      ringOpacity.setValue(0.35);
      avatarScale.setValue(1);

      const thinkLoop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(ringScale, {
              toValue: 1.18,
              duration: 750,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(ringOpacity, {
              toValue: 0.12,
              duration: 750,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(avatarScale, {
              toValue: 0.96,
              duration: 750,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(ringScale, {
              toValue: 1.02,
              duration: 750,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(ringOpacity, {
              toValue: 0.38,
              duration: 750,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(avatarScale, {
              toValue: 1,
              duration: 750,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      );

      thinkLoop.start();
      return () => {
        thinkLoop.stop();
      };
    }

    // status === 'speaking'
    ringScale.setValue(1);
    ringOpacity.setValue(0.5);
    avatarScale.setValue(1);

    const speakRingLoop = Animated.loop(
      Animated.parallel([
        Animated.timing(ringScale, {
          toValue: 1.28,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const speakPulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(avatarScale, {
          toValue: 1.04,
          duration: 420,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(avatarScale, {
          toValue: 1,
          duration: 420,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    speakRingLoop.start();
    speakPulseLoop.start();

    return () => {
      speakRingLoop.stop();
      speakPulseLoop.stop();
    };
  }, [status, ringScale, ringOpacity, avatarScale]);

  const ringColor =
    status === 'listening'
      ? colors.dangerText
      : status === 'thinking'
        ? colors.accent
        : colors.primary;

  const circleBorderColor =
    status === 'listening' || status === 'error'
      ? colors.dangerText
      : status === 'thinking'
        ? colors.accentDark
        : colors.primary;

  const circleBgColor =
    status === 'listening' || status === 'error'
      ? colors.danger
      : status === 'thinking'
        ? colors.accentLight
        : status === 'speaking'
          ? colors.primaryLight
          : colors.surfaceWarm;

  const circleBorderWidth = status === 'error' ? 2.2 : status === 'idle' ? 1.5 : 2;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {status !== 'idle' && status !== 'error' && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseRing,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: ringColor,
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
        />
      )}

      <Animated.View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: circleBgColor,
            borderColor: circleBorderColor,
            borderWidth: circleBorderWidth,
            transform: [{ scale: avatarScale }],
          },
        ]}
      >
        <Image
          source={require('../../assets/images/mimamori-leaf-icon.png')}
          style={{ width: iconSize, height: iconSize }}
          resizeMode="contain"
        />
      </Animated.View>

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
              backgroundColor: STATUS_DOT_COLOR[status],
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
