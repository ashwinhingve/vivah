import { getTranslations } from 'next-intl/server';
import { Globe, Eye, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { fetchWebsite } from '@/lib/wedding-api';
import { saveWebsiteAction } from './actions';

interface PageProps { params: Promise<{ locale: string; id: string }> }

export default async function WebsitePage({ params }: PageProps) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'weddings.invite.builder' });
  const site = await fetchWebsite(id);

  return (
    <PageTransition>
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
          <PageHeader
            title={t('heading')}
            description={t('subtitle')}
          />

        {site && site.isPublic && (
          <div className="bg-success/10 border border-success/30 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-success" />
              <div>
                <p className="font-semibold text-success">{t('liveLabel')}</p>
                <p className="text-xs text-success">{t('liveUrl', { slug: site.slug, views: site.viewCount })}</p>
              </div>
            </div>
            <a href={`/w/${site.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-teal hover:underline">
              <Eye className="h-3 w-3" /> {t('view')}
            </a>
          </div>
        )}

        <form action={saveWebsiteAction.bind(null, id)} className="bg-surface border border-gold/20 rounded-xl shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('slugLabel')} name="slug" defaultValue={site?.slug ?? ''} placeholder="riya-arjun-2026" required pattern="[a-z0-9-]+" />
            <Field label={t('titleLabel')} name="title" defaultValue={site?.title ?? ''} placeholder="Riya & Arjun" required />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t('storyLabel')}</label>
            <textarea name="story" rows={4} defaultValue={site?.story ?? ''}
              placeholder={t('storyPlaceholder')}
              className="w-full rounded-lg border border-gold/30 px-3 py-2 text-sm" />
          </div>

          <Field label={t('heroLabel')} name="heroImageKey" defaultValue={site?.heroImageKey ?? ''} placeholder="photos/hero.jpg" />

          <fieldset className="border border-gold/20 rounded-lg p-4">
            <legend className="text-xs font-medium text-muted-foreground px-2">{t('themeLegend')}</legend>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t('primary')} name="themePrimary" type="color" defaultValue={site?.theme?.primary ?? 'var(--color-primary)'} />
              <Field label={t('accent')} name="themeAccent" type="color" defaultValue={site?.theme?.accent ?? 'var(--color-gold)'} />
              <Field label={t('font')} name="themeFont" defaultValue={site?.theme?.font ?? 'Playfair Display'} />
            </div>
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Toggle name="isPublic" label={t('publishPublic')} defaultChecked={site?.isPublic ?? false} />
            <Toggle name="rsvpEnabled" label={t('showRsvp')} defaultChecked={site?.rsvpEnabled ?? true} />
            <Toggle name="registryEnabled" label={t('showRegistry')} defaultChecked={site?.registryEnabled ?? false} />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t('passwordLabel')}</label>
            <input name="password" type="password" minLength={4} placeholder={site?.passwordProtected ? t('passwordKeep') : t('passwordNone')}
              className="w-full min-h-[40px] rounded-lg border border-gold/30 px-3 py-2 text-sm" />
          </div>

          <button type="submit" className="w-full min-h-[44px] rounded-lg bg-primary text-white text-sm font-semibold">
            {site ? t('save') : t('create')}
          </button>
        </form>
        </div>
      </main>
    </PageTransition>
  );
}

function Field({ label, name, defaultValue, placeholder, required, type = 'text', pattern }: { label: string; name: string; defaultValue?: string; placeholder?: string; required?: boolean; type?: string; pattern?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} required={required} pattern={pattern}
        className="w-full min-h-[40px] rounded-lg border border-gold/30 px-3 py-2 text-sm" />
    </div>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="rounded border-gold/40" />
      {label}
    </label>
  );
}
