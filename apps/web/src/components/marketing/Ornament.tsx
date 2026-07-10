import { cn } from '@/lib/utils';

/**
 * Wedding-invitation ornament vocabulary shared by every landing section:
 * a small-caps eyebrow flanked by gold rules and diamonds (─◇ TEXT ◇─).
 * `tone="dark"` variant sits on plum/burgundy surfaces (footer, CTA band).
 */

function Diamond({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block h-1.5 w-1.5 rotate-45 rounded-[1px]', className)}
    />
  );
}

export function Eyebrow({
  children,
  tone = 'light',
  align = 'center',
  className,
}: {
  children: React.ReactNode;
  tone?: 'light' | 'dark';
  align?: 'center' | 'left';
  className?: string;
}) {
  const dark = tone === 'dark';
  return (
    <span
      className={cn(
        'flex items-center gap-3 text-[0.6875rem] font-semibold uppercase tracking-[0.22em]',
        align === 'center' ? 'justify-center' : 'justify-start',
        dark ? 'text-gold-light' : 'text-gold-muted',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'hidden h-px w-8 sm:inline-block',
          dark
            ? 'bg-gradient-to-r from-transparent to-gold/70'
            : 'bg-gradient-to-r from-transparent to-gold',
        )}
      />
      <Diamond className={dark ? 'bg-gold/80' : 'bg-gold'} />
      <span>{children}</span>
      <Diamond className={dark ? 'bg-gold/80' : 'bg-gold'} />
      {align === 'center' && (
        <span
          aria-hidden
          className={cn(
            'hidden h-px w-8 sm:inline-block',
            dark
              ? 'bg-gradient-to-l from-transparent to-gold/70'
              : 'bg-gradient-to-l from-transparent to-gold',
          )}
        />
      )}
    </span>
  );
}

/** Short rule-with-diamond used under footer column headings. */
export function HeadingRule({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('mt-2 flex items-center gap-1.5', className)}>
      <span className="h-px w-7 bg-gold/60" />
      <Diamond className="h-1 w-1 bg-gold/70" />
      <span className="h-px w-2.5 bg-gold/40" />
    </span>
  );
}
