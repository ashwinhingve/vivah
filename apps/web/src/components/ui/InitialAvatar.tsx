import { cn } from '@/lib/utils';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type Shape = 'circle' | 'square' | 'card';
type Accent = 'teal' | 'gold' | 'primary';

interface InitialAvatarProps {
  name: string | null | undefined;
  size?: Size;
  shape?: Shape;
  className?: string;
}

const SIZE_BOX: Record<Size, string> = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-20 w-20',
  xl: 'h-32 w-32',
};

const SIZE_TEXT: Record<Size, string> = {
  xs: 'text-[11px]',
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-4xl',
  xl: 'text-[56px]',
};

const SHAPE_CLASS: Record<Shape, string> = {
  circle: 'rounded-full',
  square: 'rounded-2xl',
  card: 'rounded-2xl aspect-[4/5] h-auto w-full',
};

const ACCENT_BG: Record<Accent, string> = {
  teal:    'bg-gradient-to-br from-teal/20 to-teal/5',
  gold:    'bg-gradient-to-br from-gold/30 to-gold/10',
  primary: 'bg-gradient-to-br from-primary/20 to-primary/5',
};

const ACCENT_TEXT: Record<Accent, string> = {
  teal:    'text-teal',
  gold:    'text-primary',
  primary: 'text-gold',
};

const ACCENTS: Accent[] = ['teal', 'gold', 'primary'];

function pickAccent(name: string | null | undefined): Accent {
  const code = name?.trim()?.charCodeAt(0);
  const idx = typeof code === 'number' && !Number.isNaN(code) ? code % ACCENTS.length : 0;
  return ACCENTS[idx]!;
}

function pickInitial(name: string | null | undefined): string {
  const ch = name?.trim()?.charAt(0)?.toUpperCase();
  return ch && /[A-Z0-9]/.test(ch) ? ch : '?';
}

/**
 * Canonical fallback for any missing profile/vendor photo. Renders a
 * deterministic accent (teal/gold/primary) hashed from the name so the
 * same person reads the same colour across every surface.
 */
export function InitialAvatar({
  name,
  size = 'md',
  shape = 'circle',
  className,
}: InitialAvatarProps) {
  const accent = pickAccent(name);
  const initial = pickInitial(name);
  const isCard = shape === 'card';
  return (
    <span
      aria-label={name ? `${name} avatar` : 'Profile avatar'}
      role="img"
      className={cn(
        'flex select-none items-center justify-center overflow-hidden',
        ACCENT_BG[accent],
        SHAPE_CLASS[shape],
        isCard ? '' : SIZE_BOX[size],
        className,
      )}
    >
      <span
        className={cn(
          'font-heading font-semibold leading-none',
          ACCENT_TEXT[accent],
          SIZE_TEXT[size],
        )}
      >
        {initial}
      </span>
    </span>
  );
}
