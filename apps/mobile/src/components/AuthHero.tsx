import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Eyebrow } from '@/components/Ornament';
import { LogoMark } from '@/components/Logo';
import { withAlpha, tokens } from '@/theme/tokens';

/**
 * AuthHero — the auth flow's brand hero: an arch-top frame (the web hero's
 * Mughal-arch motif, approximated with large numeric top radii — RN has no
 * two-axis border-radius) holding a warm blush wash and the Smart Shaadi logo
 * badge, followed by the ─◇ SMART SHAADI ◇─ eyebrow, Playfair title, and
 * subtitle.
 */
interface AuthHeroProps {
  title: string;
  subtitle?: string;
  /** Smaller arch for keyboard-heavy screens (OTP entry). */
  compact?: boolean;
}

const WASH = [tokens.blush, withAlpha(tokens.peach, '66'), tokens.background] as const;

export function AuthHero({ title, subtitle, compact = false }: AuthHeroProps) {
  const width = compact ? 108 : 148;
  const height = compact ? 126 : 172;

  return (
    <View className="items-center mb-8">
      <Animated.View
        entering={FadeIn.duration(500)}
        style={{
          width,
          height,
          borderTopLeftRadius: width / 2,
          borderTopRightRadius: width / 2,
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
          borderWidth: 1,
          borderColor: withAlpha(tokens.gold, '66'),
          overflow: 'hidden',
        }}
      >
        <LinearGradient colors={WASH} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <LogoMark size={compact ? 56 : 72} decorative />
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(400)} className="items-center">
        <Eyebrow text="Smart Shaadi" className="mt-5 mb-3" />
        <Text className="font-heading-bold text-3xl text-primary text-center">{title}</Text>
        {subtitle ? (
          <Text className="text-base text-gold-muted text-center mt-2 px-4">{subtitle}</Text>
        ) : null}
      </Animated.View>
    </View>
  );
}
