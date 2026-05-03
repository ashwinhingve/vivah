import Link from 'next/link';
import { ArrowLeft, Globe, Eye, Sparkles } from 'lucide-react';
import { fetchWebsite } from '@/lib/wedding-api';
import { saveWebsiteAction } from './actions';

interface PageProps { params: Promise<{ id: string }> }

export default async function WebsitePage({ params }: PageProps) {
  const { id } = await params;
  const site = await fetchWebsite(id);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
        <Link href={`/weddings/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-4 min-h-[44px]">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <Globe className="h-6 w-6 text-gold" />
          <h1 className="font-heading text-2xl text-primary">Wedding Website</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">A public landing page guests can visit. Share the link via your invitations.</p>

        {site && site.isPublic && (
          <div className="bg-success/10 border border-success/30 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-success" />
              <div>
                <p className="font-semibold text-success">Live</p>
                <p className="text-xs text-success">/w/{site.slug} · {site.viewCount} views</p>
              </div>
            </div>
            <a href={`/w/${site.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-teal hover:underline">
              <Eye className="h-3 w-3" /> View
            </a>
          </div>
        )}

        <form action={saveWebsiteAction.bind(null, id)} className="bg-surface border border-gold/20 rounded-xl shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="URL slug *" name="slug" defaultValue={site?.slug ?? ''} placeholder="riya-arjun-2026" required pattern="[a-z0-9-]+" />
            <Field label="Title *" name="title" defaultValue={site?.title ?? ''} placeholder="Riya & Arjun" required />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Our story</label>
            <textarea name="story" rows={4} defaultValue={site?.story ?? ''}
              placeholder="How we met, why we're getting married, what guests should know…"
              className="w-full rounded-lg border border-gold/30 px-3 py-2 text-sm" />
          </div>

          <Field label="Hero image R2 key" name="heroImageKey" defaultValue={site?.heroImageKey ?? ''} placeholder="photos/hero.jpg" />

          <fieldset className="border border-gold/20 rounded-lg p-4">
            <legend className="text-xs font-medium text-muted-foreground px-2">Theme</legend>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Primary" name="themePrimary" type="color" defaultValue={site?.theme?.primary ?? 'var(--color-primary)'} />
              <Field label="Accent" name="themeAccent" type="color" defaultValue={site?.theme?.accent ?? 'var(--color-gold)'} />
              <Field label="Font" name="themeFont" defaultValue={site?.theme?.font ?? 'Playfair Display'} />
            </div>
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Toggle name="isPublic" label="Publish public" defaultChecked={site?.isPublic ?? false} />
            <Toggle name="rsvpEnabled" label="Show RSVP" defaultChecked={site?.rsvpEnabled ?? true} />
            <Toggle name="registryEnabled" label="Show registry" defaultChecked={site?.registryEnabled ?? false} />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Site password (optional)</label>
            <input name="password" type="password" minLength={4} placeholder={site?.passwordProtected ? 'Already set — leave blank to keep' : 'Leave blank for no password'}
              className="w-full min-h-[40px] rounded-lg border border-gold/30 px-3 py-2 text-sm" />
          </div>

          <button type="submit" className="w-full min-h-[44px] rounded-lg bg-primary text-white text-sm font-semibold">
            {site ? 'Save changes' : 'Create website'}
          </button>
        </form>
      </div>
    </div>
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
