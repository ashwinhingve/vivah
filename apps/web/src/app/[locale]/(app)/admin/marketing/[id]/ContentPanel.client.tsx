'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Zap } from 'lucide-react';
import type { CampaignContent } from '@smartshaadi/types';

// Cross-origin api base (ADR-002): cookies only travel with credentials:'include'.
const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface ContentPanelProps {
  campaignId: string;
  content: CampaignContent[];
}

type EditingLanguage = 'en' | 'hi' | null;

export function ContentPanel({ campaignId, content }: ContentPanelProps) {
  const t = useTranslations('adminMarketing');
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState<EditingLanguage>(null);

  const enContent = content.find((c) => c.language === 'en');
  const hiContent = content.find((c) => c.language === 'hi');

  const handleRequestGeneration = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/marketing/content/${campaignId}/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        // Polling or auto-refresh would happen here
        // For now, user needs to refresh manually
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-primary">{t('contentPanel.title')}</h2>
        <button
          onClick={handleRequestGeneration}
          disabled={generating}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
        >
          <Zap className="h-5 w-5" />
          {generating ? t('contentPanel.generating') : t('contentPanel.generateCopy')}
        </button>
      </div>

      {/* EN and HI side by side (stacked on mobile) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ContentPreview
          language="en"
          content={enContent}
          onEdit={() => setEditing('en')}
        />
        <ContentPreview
          language="hi"
          content={hiContent}
          onEdit={() => setEditing('hi')}
        />
      </div>

      {/* Edit form (modal-like) */}
      {editing && (
        <ContentEditForm
          language={editing}
          campaignId={campaignId}
          initialContent={editing === 'en' ? enContent : hiContent}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

interface ContentPreviewProps {
  language: 'en' | 'hi';
  content?: CampaignContent;
  onEdit: () => void;
}

function ContentPreview({ language, content, onEdit }: ContentPreviewProps) {
  const t = useTranslations('adminMarketing');
  const langLabel = language === 'en' ? 'English' : 'हिंदी';

  return (
    <Card padding="md">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-primary">{langLabel}</h3>
        {content?.status && (
          <span className={`inline-block rounded-full border px-2 py-1 text-xs font-semibold ${
            content.status === 'APPROVED'
              ? 'bg-success/10 text-success border-success/20'
              : 'bg-surface-muted text-muted-foreground border-border'
          }`}>
            {content.status}
          </span>
        )}
      </div>

      {content ? (
        <div className="space-y-3">
          {content.subjectLine && (
            <div>
              <p className="text-xs text-muted-foreground">{t('contentPanel.subject')}</p>
              <p className="text-sm text-foreground">{content.subjectLine}</p>
            </div>
          )}
          {content.bodyShort && (
            <div>
              <p className="text-xs text-muted-foreground">{t('contentPanel.bodyShort')}</p>
              <p className="text-sm text-foreground line-clamp-2">{content.bodyShort}</p>
            </div>
          )}
          {content.ctaText && (
            <div>
              <p className="text-xs text-muted-foreground">{t('contentPanel.cta')}</p>
              <p className="text-sm font-medium text-teal">{content.ctaText}</p>
            </div>
          )}
          <button
            onClick={onEdit}
            className="mt-4 inline-flex h-11 items-center rounded-lg border border-gold-muted px-4 text-sm font-semibold text-primary hover:bg-background"
          >
            {t('contentPanel.edit')}
          </button>
          {content.status === 'DRAFT' && (
            <button
              onClick={() => approveContent(content.id)}
              className="ml-2 inline-flex h-11 items-center rounded-lg bg-success px-4 text-sm font-semibold text-primary-foreground hover:bg-success/90"
            >
              {t('contentPanel.approve')}
            </button>
          )}
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">{t('contentPanel.noContent')}</p>
      )}
    </Card>
  );
}

interface ContentEditFormProps {
  language: 'en' | 'hi';
  campaignId: string;
  initialContent?: CampaignContent;
  onClose: () => void;
}

function ContentEditForm({ language, campaignId, initialContent, onClose }: ContentEditFormProps) {
  const t = useTranslations('adminMarketing');
  const [subject, setSubject] = useState(initialContent?.subjectLine || '');
  const [bodyShort, setBodyShort] = useState(initialContent?.bodyShort || '');
  const [bodyLong, setBodyLong] = useState(initialContent?.bodyLong || '');
  const [cta, setCta] = useState(initialContent?.ctaText || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/marketing/content/${campaignId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: language as 'en' | 'hi',
          subjectLine: subject || null,
          bodyShort,
          bodyLong: bodyLong || null,
          ctaText: cta || null,
        }),
      });
      if (res.ok) {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding="md">
      <h3 className="mb-4 font-semibold text-primary">{t('contentPanel.editForm')}</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-foreground">{t('contentPanel.subject')}</label>
          <input
            type="text"
            maxLength={255}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gold-muted px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">{t('contentPanel.bodyShort')}</label>
          <textarea
            maxLength={500}
            value={bodyShort}
            onChange={(e) => setBodyShort(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-gold-muted px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">{t('contentPanel.bodyLong')}</label>
          <textarea
            maxLength={5000}
            value={bodyLong}
            onChange={(e) => setBodyLong(e.target.value)}
            rows={5}
            className="mt-1 w-full rounded-lg border border-gold-muted px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">{t('contentPanel.cta')}</label>
          <input
            type="text"
            maxLength={100}
            value={cta}
            onChange={(e) => setCta(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gold-muted px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2 pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
          >
            {saving ? t('contentPanel.saving') : t('contentPanel.save')}
          </button>
          <button
            onClick={onClose}
            className="inline-flex h-11 items-center rounded-lg border border-gold-muted px-4 text-sm font-semibold text-foreground hover:bg-background"
          >
            {t('contentPanel.cancel')}
          </button>
        </div>
      </div>
    </Card>
  );
}

async function approveContent(contentId: string) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/admin/marketing/content/approve`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentId }),
    });
    if (res.ok) {
      window.location.reload();
    }
  } catch (err) {
    console.error('Approval failed:', err);
  }
}
