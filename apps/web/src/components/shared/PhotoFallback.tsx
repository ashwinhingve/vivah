import { cn } from '@/lib/utils';
import { InitialAvatar } from '@/components/ui/InitialAvatar';

interface PhotoFallbackProps {
  name: string;
  className?: string;
  /** Retained for back-compat; ignored — InitialAvatar handles its own text size. */
  textClassName?: string;
}

/**
 * Full-bleed fallback for missing card photos. Delegates to the canonical
 * InitialAvatar so every fallback across the app shares the same
 * deterministic accent + Playfair initial.
 */
export function PhotoFallback({ name, className }: PhotoFallbackProps) {
  return (
    <InitialAvatar
      name={name}
      size="xl"
      shape="square"
      className={cn('h-full w-full rounded-none', className)}
    />
  );
}
