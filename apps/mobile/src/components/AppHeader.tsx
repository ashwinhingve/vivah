import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { tokens } from '@/theme/tokens';

/**
 * AppHeader — the standard screen header: optional back circle, Playfair
 * title, optional subtitle, and a right-hand slot for icon actions.
 * Replaces the ad-hoc "← Back" text links and bare title Texts.
 */
interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  /** Right-hand slot — compose with <HeaderIconButton>. */
  right?: ReactNode;
  className?: string;
}

export function AppHeader({ title, subtitle, showBack = false, onBack, right, className = '' }: AppHeaderProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(350)}
      className={`flex-row items-center gap-3 mb-6 ${className}`}
    >
      {showBack ? (
        <Pressable
          onPress={onBack ?? (() => router.back())}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={4}
          className="h-11 w-11 items-center justify-center rounded-full bg-gold/10 active:bg-gold/20"
        >
          <ChevronLeft size={24} color={tokens.primary} />
        </Pressable>
      ) : null}
      <View className="flex-1">
        <Text className="font-heading text-2xl text-primary" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-sm text-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Animated.View>
  );
}

/** 44px circular icon action for the header's right slot. */
interface HeaderIconButtonProps {
  icon: ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
}

export function HeaderIconButton({ icon, accessibilityLabel, onPress, testID }: HeaderIconButtonProps) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      className="h-11 w-11 items-center justify-center rounded-full bg-gold/10 active:bg-gold/20"
    >
      {icon}
    </Pressable>
  );
}
