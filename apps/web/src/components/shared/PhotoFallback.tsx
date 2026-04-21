import { cn } from '@/lib/utils';

interface PhotoFallbackProps {
  name: string;
  className?: string;
  textClassName?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Warm burgundy → gold gradient with centered initials.
 * Used as the fallback any time a profile photo is missing — replaces
 * the cold gray box anti-pattern called out in ui-component.md Step 4.
 */
export function PhotoFallback({ name, className, textClassName }: PhotoFallbackProps) {
  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center bg-gradient-to-br from-primary via-primary-light to-gold',
        className
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          'font-heading text-4xl font-semibold text-white drop-shadow-sm',
          textClassName
        )}
      >
        {getInitials(name) || '♥'}
      </span>
    </div>
  );
}
