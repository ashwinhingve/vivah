import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { withAlpha, tokens } from '@/theme/tokens';

/**
 * Ornament — the brand's gold "eyebrow" mark (─◇ TEXT ◇─) and section divider,
 * ported from the web's marketing Ornament component. Rules fade toward the
 * outside; diamonds are tiny rotated squares.
 */
const RULE_TO_GOLD = ['rgba(197, 164, 126, 0)', tokens.gold] as const;
const RULE_FROM_GOLD = [tokens.gold, 'rgba(197, 164, 126, 0)'] as const;

function Diamond({ size = 5 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: tokens.gold,
        transform: [{ rotate: '45deg' }],
      }}
    />
  );
}

function Rule({ direction }: { direction: 'in' | 'out' }) {
  return (
    <LinearGradient
      colors={direction === 'in' ? RULE_TO_GOLD : RULE_FROM_GOLD}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={{ height: 1, width: 32 }}
    />
  );
}

interface EyebrowProps {
  text: string;
  className?: string;
}

/** ─◇ UPPERCASE MICRO-LABEL ◇─ — section header eyebrow. */
export function Eyebrow({ text, className = '' }: EyebrowProps) {
  return (
    <View className={`flex-row items-center justify-center gap-2 ${className}`}>
      <Rule direction="in" />
      <Diamond />
      <Text
        className="text-2xs font-semibold uppercase text-gold-muted"
        style={{ letterSpacing: 2.4 }}
      >
        {text}
      </Text>
      <Diamond />
      <Rule direction="out" />
    </View>
  );
}

/** ── ◇ ── — quiet divider between page sections. */
export function SectionDivider({ className = '' }: { className?: string }) {
  return (
    <View className={`flex-row items-center justify-center gap-3 py-4 ${className}`}>
      <View style={{ height: 1, flex: 1, backgroundColor: withAlpha(tokens.gold, '66') }} />
      <Diamond size={6} />
      <View style={{ height: 1, flex: 1, backgroundColor: withAlpha(tokens.gold, '66') }} />
    </View>
  );
}
