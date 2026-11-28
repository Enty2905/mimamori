import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export function formatWaterLiters(ml?: number | null): string {
  const safeMl = Math.max(0, Math.round(ml ?? 0));
  if (safeMl === 0) return '0';
  const liters = safeMl / 1000;
  if (safeMl % 100 === 0) {
    return liters.toFixed(1);
  }
  return liters.toFixed(2);
}

interface WaterFillCircleProps {
  percent: number;
  completedMl: number;
  targetMl: number;
  size?: number;
}

export const WaterFillCircle: React.FC<WaterFillCircleProps> = ({
  percent,
  completedMl,
  targetMl,
  size = 86,
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const animRef = useRef(new Animated.Value(clamped));
  const [visualPercent, setVisualPercent] = useState(clamped);

  useEffect(() => {
    const valueRef = animRef.current;
    const id = valueRef.addListener(({ value }) => {
      setVisualPercent(value);
    });
    const animation = Animated.timing(valueRef, {
      toValue: clamped,
      duration: 550,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      valueRef.removeListener(id);
      animation.stop();
    };
  }, [clamped]);

  const strokeWidth = 3;
  const radius = size / 2;
  const innerRadius = radius - strokeWidth;
  const fillRatio = Math.max(0, Math.min(100, visualPercent)) / 100;
  const waterTopY = size - fillRatio * size;
  const waveAmp = clamped > 0 && clamped < 100 ? 4.5 : 0;

  // Dual smooth wave crest across the circle diameter so liquid movement looks natural
  const wavePath = `M 0 ${waterTopY} Q ${size * 0.25} ${waterTopY - waveAmp} ${size * 0.5} ${waterTopY} T ${size} ${waterTopY} L ${size} ${size} L 0 ${size} Z`;
  const backWavePath = `M 0 ${waterTopY - 1.5} Q ${size * 0.3} ${waterTopY + waveAmp} ${size * 0.65} ${waterTopY - 1.5} T ${size} ${waterTopY - 1.5} L ${size} ${size} L 0 ${size} Z`;

  const isMostlySubmerged = visualPercent >= 56;
  const completedLabel = formatWaterLiters(completedMl);
  const targetLabel = formatWaterLiters(targetMl);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <ClipPath id="waterCircleClip">
            <Circle cx={radius} cy={radius} r={innerRadius} />
          </ClipPath>
          <LinearGradient id="oceanWaterGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#38BDF8" />
            <Stop offset="45%" stopColor="#0EA5E9" />
            <Stop offset="100%" stopColor="#0369A1" />
          </LinearGradient>
        </Defs>

        {/* Pale sky/ocean circle backdrop */}
        <Circle
          cx={radius}
          cy={radius}
          r={innerRadius}
          fill="#E0F2FE"
        />

        {/* Rising liquid layers clipped inside the circle */}
        <Rect
          x={0}
          y={0}
          width={size}
          height={size}
          fill="transparent"
          clipPath="url(#waterCircleClip)"
        />
        {clamped > 0 && (
          <>
            <Path
              d={backWavePath}
              fill="#7DD3FC"
              opacity={0.75}
              clipPath="url(#waterCircleClip)"
            />
            <Path
              d={wavePath}
              fill="url(#oceanWaterGrad)"
              clipPath="url(#waterCircleClip)"
            />
          </>
        )}

        {/* Crisp ocean-blue outer ring */}
        <Circle
          cx={radius}
          cy={radius}
          r={innerRadius}
          fill="none"
          stroke="#0284C7"
          strokeWidth={strokeWidth}
        />
      </Svg>

      <View style={styles.centerOverlay} pointerEvents="none">
        <Text
          style={[
            styles.percentText,
            isMostlySubmerged ? styles.textOverWater : styles.textOverEmpty,
          ]}
        >
          {clamped}%
        </Text>
        <Text
          style={[
            styles.litersText,
            isMostlySubmerged ? styles.subTextOverWater : styles.subTextOverEmpty,
          ]}
        >
          {completedLabel}/{targetLabel}L
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  percentText: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  litersText: {
    fontSize: 10.5,
    fontWeight: '800',
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  textOverEmpty: {
    color: '#075985',
  },
  subTextOverEmpty: {
    color: '#0369A1',
  },
  textOverWater: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(3, 105, 161, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subTextOverWater: {
    color: '#E0F2FE',
    textShadowColor: 'rgba(3, 105, 161, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
