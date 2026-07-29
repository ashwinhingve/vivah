import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { withAlpha, tokens } from '@/theme/tokens';

/**
 * Avatar — photo with graceful fallback. Broken/missing photos render initials
 * on a soft burgundy gradient (web's avatar-fallback pattern) instead of a
 * blank box or bare "No photo" text. Optional gold ring for premium framing.
 */
type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  uri?: string | null;
  /** Display name — initials are derived from its first two words. */
  name: string;
  size?: AvatarSize;
  /** Gold ring around the photo (web: ring-2 ring-gold/70). */
  ringed?: boolean;
  className?: string;
  testID?: string;
}

const SIZES: Record<AvatarSize, number> = { xs: 24, sm: 32, md: 48, lg: 80, xl: 120 };
const FONT_SIZES: Record<AvatarSize, number> = { xs: 9, sm: 12, md: 17, lg: 28, xl: 42 };

const FALLBACK_GRADIENT = [withAlpha(tokens.primary, '2E'), withAlpha(tokens.primary, '0D')] as const;

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]?.[0] ?? '';
  const second = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${second}`.toUpperCase() || '?';
}

export function Avatar({ uri, name, size = 'md', ringed = false, className = '', testID }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  // A new uri deserves a fresh attempt (list rows recycle components).
  useEffect(() => setFailed(false), [uri]);

  const px = SIZES[size];
  const showImage = !!uri && !failed;

  const core = (
    <View
      style={{ width: px, height: px, borderRadius: px / 2, overflow: 'hidden' }}
      accessibilityLabel={`${name} photo`}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={200}
          onError={() => setFailed(true)}
        />
      ) : (
        <LinearGradient colors={FALLBACK_GRADIENT} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            className="font-heading text-primary"
            style={{ fontSize: FONT_SIZES[size], lineHeight: FONT_SIZES[size] * 1.2 }}
          >
            {initialsOf(name)}
          </Text>
        </LinearGradient>
      )}
    </View>
  );

  if (!ringed) {
    return (
      <View testID={testID} className={className}>
        {core}
      </View>
    );
  }

  return (
    <View
      testID={testID}
      className={className}
      style={{
        padding: 2,
        borderRadius: px / 2 + 4,
        borderWidth: 2,
        borderColor: withAlpha(tokens.gold, 'B3'),
      }}
    >
      {core}
    </View>
  );
}
