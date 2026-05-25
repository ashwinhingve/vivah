import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Mail, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Help & Support — Smart Shaadi',
};

const SUPPORT_EMAIL = 'support@smartshaadi.co.in';
const FAQ_KEYS = ['verification', 'matching', 'privacy'] as const;

export default async function HelpPage() {
  const t = await getTranslations('help');

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <header className="text-center">
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-primary">
            {t('title')}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">{t('subtitle')}</p>
        </header>

        <Card className="mt-10 flex flex-col items-center gap-4 border-gold/25 p-8 text-center shadow-card">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal/10 text-teal">
            <Mail className="h-5 w-5" aria-hidden="true" />
          </span>
          <Button asChild size="lg">
            <a href={`mailto:${SUPPORT_EMAIL}`}>
              <Mail className="h-4 w-4" aria-hidden="true" />
              {t('emailUs')}
            </a>
          </Button>
        </Card>

        <section className="mt-10 space-y-3">
          {FAQ_KEYS.map((k) => (
            <details
              key={k}
              className="group rounded-2xl border border-gold/20 bg-surface p-5 shadow-card open:border-gold/40"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-heading text-base font-semibold text-primary">
                <span>{t(`faq.${k}.q`)}</span>
                <ChevronDown
                  className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t(`faq.${k}.a`)}
              </p>
            </details>
          ))}
        </section>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          {t('stillNeedHelp')}{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-teal underline-offset-4 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </main>
  );
}
