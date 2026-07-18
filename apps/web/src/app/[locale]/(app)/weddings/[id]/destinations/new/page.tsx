import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { DestinationForm } from '../_components/DestinationForm.client';

/**
 * Add a destination leg (Phase 8 Unit 8.1).
 *
 * Server component: it resolves the copy and hands it to the client form, so the
 * form itself needs no translation context and stays a thin interactive shell.
 */
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NewDestinationPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations('weddings.destinations');

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
        <PageHeader
          title={t('newTitle')}
          subtitle={t('newSubtitle')}
          breadcrumbs={[
            { label: t('breadcrumbWeddings'), href: '/weddings' },
            { label: t('heading'), href: `/weddings/${id}/destinations` },
            { label: t('newTitle') },
          ]}
        />

        <div className="rounded-2xl border border-gold/20 bg-surface p-5 shadow-card sm:p-6">
          <DestinationForm
            weddingId={id}
            labels={{
              city:             t('form.city'),
              cityPlaceholder:  t('form.cityPlaceholder'),
              countryCode:      t('form.countryCode'),
              timezone:         t('form.timezone'),
              arriveOn:         t('arriveOn'),
              departOn:         t('departOn'),
              notes:            t('form.notes'),
              notesPlaceholder: t('form.notesPlaceholder'),
              makePrimary:      t('form.makePrimary'),
              makePrimaryHint:  t('form.makePrimaryHint'),
              submit:           t('form.submit'),
              submitting:       t('form.submitting'),
              cancel:           t('form.cancel'),
              windowError:      t('form.windowError'),
            }}
          />
        </div>
      </div>
    </div>
  );
}
