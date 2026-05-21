'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { Globe, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const LABELS: Record<Locale, { full: string; short: string }> = {
  en: { full: 'English', short: 'EN' },
  hi: { full: 'हिंदी', short: 'हि' },
};

export function LanguageToggle({ variant = 'compact' }: { variant?: 'compact' | 'minimal' }) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const swap = (next: Locale) => {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  const current = LABELS[locale];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground/80 hover:bg-foreground/5 hover:text-primary transition-colors min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isPending && 'opacity-60',
          variant === 'minimal' && 'px-1.5'
        )}
        aria-label={`Language: ${current.full}. Click to change.`}
      >
        <Globe className="h-4 w-4" aria-hidden />
        <span aria-hidden>{current.short}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-[10rem]">
        {routing.locales.map((loc) => {
          const isActive = loc === locale;
          const label = LABELS[loc];
          return (
            <DropdownMenuItem
              key={loc}
              onSelect={() => swap(loc)}
              className={cn(
                'flex items-center justify-between cursor-pointer',
                isActive && 'text-primary font-semibold'
              )}
            >
              <span>{label.full}</span>
              {isActive && <Check className="h-4 w-4" aria-hidden />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
