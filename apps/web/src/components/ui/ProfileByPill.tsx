import { User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProfileCreator = 'self' | 'parent' | 'sibling' | 'relative' | 'friend';

const labels: Record<ProfileCreator, string> = {
  self: 'Profile by Self',
  parent: 'Profile by Parent',
  sibling: 'Profile by Sibling',
  relative: 'Profile by Relative',
  friend: 'Profile by Friend',
};

interface Props {
  creator: ProfileCreator;
  className?: string;
  /** White-on-translucent variant for use atop hero photos. */
  inverse?: boolean;
}

export function ProfileByPill({ creator, className, inverse }: Props) {
  const Icon = creator === 'self' ? User : Users;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
        inverse ? 'bg-white/20 text-white backdrop-blur-sm' : 'bg-primary/10 text-primary',
        className,
      )}
    >
      <Icon strokeWidth={1.75} className="h-3 w-3" aria-hidden />
      {labels[creator]}
    </span>
  );
}
