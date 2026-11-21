import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors } from '../core/theme/colors';

interface VoiceWaveformProps {
  audioLevel: number;
  active?: boolean;
  color?: string;
  height?: number;
}

const BAR_WEIGHTS = [0.34, 0.54, 0.76, 0.92, 1.0, 0.92, 0.76, 0.54, 0.34];

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  audioLevel,
  active = true,
  color = colors.dangerText,
  height = 28,
}) => {
  const [barValues] = useState(() => BAR_WEIGHTS.map(() => new Animated.Value(0.22)));
  const tickRef = useRef(0);

  useEffect(() => {
    if (!active) {
      const resetAnims = barValues.map((val) =>
        Animated.timing(val, {
          toValue: 0.2,
          duration: 160,
          useNativeDriver: true,
        })
      );
      Animated.parallel(resetAnims).start();
      return;
    }

    tickRef.current = (tickRef.current + 1) % 6;
    const clampedLevel = Math.max(0, Math.min(1, audioLevel));
    // Boost soft voices slightly so elderly speakers see clear visual feedback
    const perceptualLevel = Math.pow(clampedLevel, 0.7);

    const anims = barValues.map((val, idx) => {
      const weight = BAR_WEIGHTS[idx];
      const ripple = 0.08 * Math.sin((tickRef.current + idx) * 1.15);
      const target = Math.max(
        0.18,
        Math.min(1, 0.2 + perceptualLevel * weight * 0.8 + Math.abs(ripple) * (0.3 + perceptualLevel))
      );
      return Animated.timing(val, {
        toValue: target,
        duration: 95,
        useNativeDriver: true,
      });
    });

    Animated.parallel(anims).start();
  }, [audioLevel, active, barValues]);

  return (
    <View style={[styles.container, { height }]} accessibilityLabel="Biểu đồ âm thanh đang thu">
      {barValues.map((val, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              height,
              backgroundColor: color,
              transform: [{ scaleY: val }],
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bar: {
    width: 4,
    borderRadius: 2,
  },
});
