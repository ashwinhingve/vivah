'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useMemo, useState } from 'react';
import { InviteCard } from '@/components/invite/InviteCard';
import { INVITE_TEMPLATES } from '@/lib/invites/templates';
import type { InviteRecord, PublicInviteView } from '@/lib/invites/types';
import { saveInviteAction, publishInviteAction, type InviteActionState } from './actions';

interface Props {
  weddingId: string;
  locale: string;
  invite: InviteRecord | null;
  previewBase: PublicInviteView;
  appBaseUrl: string;
}

const initialState: InviteActionState = { ok: false };

export function InviteBuilder({ weddingId, locale, invite, previewBase, appBaseUrl }: Props) {
  const t = useTranslations('weddings.invite');
  const [templateId, setTemplateId] = useState(previewBase.templateId);
  const [title, setTitle] = useState(previewBase.title ?? '');
  const [message, setMessage] = useState(previewBase.message ?? '');
  const [rsvpEnabled, setRsvpEnabled] = useState(previewBase.rsvpEnabled);

  const [saveState, saveAction, savePending] = useActionState(
    saveInviteAction.bind(null, weddingId),
    initialState,
  );

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const current = saveState.invite ?? invite;
  const [slug, setSlug] = useState<string | null>(invite?.slug ?? null);
  const [published, setPublished] = useState(invite?.status === 'PUBLISHED');

  const preview: PublicInviteView = useMemo(
    () => ({ ...previewBase, templateId, title: title || null, message: message || null, rsvpEnabled }),
    [previewBase, templateId, title, message, rsvpEnabled],
  );

  const publicUrl = useMemo(() => {
    if (!slug) return '';
    const base = appBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    const path = locale === 'en' ? `/i/${slug}` : `/${locale}/i/${slug}`;
    return `${base}${path}`;
  }, [slug, appBaseUrl, locale]);

  const whatsappUrl = useMemo(() => {
    if (!publicUrl) return '';
    const text = `${message || t('defaultMessage')} ${publicUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }, [publicUrl, message, t]);

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    const res = await publishInviteAction(weddingId);
    setPublishing(false);
    if (!res.ok || !res.invite) {
      setPublishError(res.error ?? 'Publish failed.');
      return;
    }
    setSlug(res.invite.slug);
    setPublished(true);
  }

  function copyLink() {
    if (publicUrl && typeof navigator !== 'undefined') navigator.clipboard.writeText(publicUrl);
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-heading text-2xl text-primary mb-1">{t('heading')}</h1>
        <p className="text-muted-foreground mb-6">
          {t('subtitle')}
        </p>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Editor */}
          <form action={saveAction} className="space-y-5">
            <input type="hidden" name="templateId" value={templateId} />
            <input type="hidden" name="rsvpEnabled" value={rsvpEnabled ? 'true' : 'false'} />

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t('templateLabel')}</label>
              <div className="grid grid-cols-3 gap-2">
                {INVITE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setTemplateId(tpl.id)}
                    aria-pressed={templateId === tpl.id}
                    className={`h-11 rounded-lg border px-2 text-sm ${
                      templateId === tpl.id
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-foreground'
                    }`}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="inv-title" className="block text-sm font-medium text-foreground mb-2">
                {t('headlineLabel')}
              </label>
              <input
                id="inv-title"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={255}
                placeholder={t('headlinePlaceholder')}
                className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-foreground"
              />
            </div>

            <div>
              <label htmlFor="inv-message" className="block text-sm font-medium text-foreground mb-2">
                {t('messageLabel')}
              </label>
              <textarea
                id="inv-message"
                name="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder={t('messagePlaceholder')}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              />
            </div>

            <label className="flex items-center gap-3 min-h-11">
              <input
                type="checkbox"
                checked={rsvpEnabled}
                onChange={(e) => setRsvpEnabled(e.target.checked)}
                className="h-5 w-5"
              />
              <span className="text-sm text-foreground">{t('rsvpLabel')}</span>
            </label>

            {saveState.error && <p className="text-sm text-destructive">{saveState.error}</p>}
            {saveState.ok && <p className="text-sm text-success">Saved.</p>}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={savePending}
                className="h-11 rounded-lg bg-teal px-5 text-surface disabled:opacity-60"
              >
                {savePending ? t('saving') : t('save')}
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="h-11 rounded-lg bg-primary px-5 text-surface disabled:opacity-60"
              >
                {publishing ? t('publishing') : published ? t('republish') : t('publish')}
              </button>
            </div>
            {publishError && <p className="text-sm text-destructive">{publishError}</p>}

            {published && slug && (
              <div className="rounded-xl border border-gold/30 bg-surface p-4 space-y-3">
                <p className="text-sm font-medium text-primary">{t('shareHeading')}</p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={publicUrl}
                    className="h-11 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    onClick={copyLink}
                    className="h-11 rounded-lg border border-border px-3 text-sm"
                  >
                    {t('copy')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center rounded-lg bg-success px-4 text-sm text-surface"
                  >
                    {t('shareWhatsapp')}
                  </a>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm text-foreground"
                  >
                    {t('openInvite')}
                  </a>
                </div>
              </div>
            )}
            {current?.status === 'DRAFT' && !published && (
              <p className="text-xs text-muted-foreground">
                {t('publishHint')}
              </p>
            )}
          </form>

          {/* Live preview */}
          <div>
            <p className="text-sm font-medium text-foreground mb-3">{t('preview')}</p>
            <InviteCard view={preview} />
          </div>
        </div>
      </div>
    </main>
  );
}
