import { useEffect, useState } from 'react';
import { View, type DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * Skeleton — warm shimmer placeholder. Never gray: base + sheen are ivory/beige
 * per the web design system's `.skeleton-warm` (gray skeletons are off-brand).
 * A soft highlight sweeps left→right on a 1.6s loop.
 */
interface SkeletonProps {
  width?: DimensionValue;
  height: number;
  /** Corner radius in px; ignored when `circle`. */
  radius?: number;
  circle?: boolean;
  className?: string;
}

const BASE = '#F3ECE2';
const SHEEN_COLORS = [
  'rgba(255, 255, 255, 0)',
  'rgba(255, 255, 255, 0.55)',
  'rgba(255, 255, 255, 0)',
] as const;
const SHEEN_WIDTH = 96;
const LOOP_MS = 1600;

export function Skeleton({ width = '100%', height, radius = 12, circle = false, className = '' }: SkeletonProps) {
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: LOOP_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [progress]);

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -SHEEN_WIDTH + progress.value * (measuredWidth + SHEEN_WIDTH * 2) },
    ],
  }));

  const resolvedWidth = circle ? height : width;
  const resolvedRadius = circle ? height / 2 : radius;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setMeasuredWidth(e.nativeEvent.layout.width)}
      className={className}
      style={{
        width: resolvedWidth,
        height,
        borderRadius: resolvedRadius,
        backgroundColor: BASE,
        overflow: 'hidden',
      }}
    >
      <Animated.View style={[{ width: SHEEN_WIDTH, height: '100%' }, sheenStyle]}>
        <LinearGradient
          colors={SHEEN_COLORS}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

/** Feed-style placeholder: tall photo block + two text lines. */
export function SkeletonFeedCard() {
  return (
    <View className="mb-4 rounded-2xl border border-gold/20 bg-surface overflow-hidden">
      <Skeleton height={224} radius={0} />
      <View className="p-4 gap-2">
        <Skeleton height={18} width="55%" radius={6} />
        <Skeleton height={14} width="35%" radius={6} />
      </View>
    </View>
  );
}

/** Row-style placeholder: avatar circle + two text lines (chat/vendor lists). */
export function SkeletonRow() {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <Skeleton height={48} circle />
      <View className="flex-1 gap-2">
        <Skeleton height={16} width="60%" radius={6} />
        <Skeleton height={12} width="85%" radius={6} />
      </View>
    </View>
  );
}
