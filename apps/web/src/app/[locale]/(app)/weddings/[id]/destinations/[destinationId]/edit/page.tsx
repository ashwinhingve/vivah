import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { fetchAuth } from '@/lib/server-fetch';
import type { DestinationDetail } from '@smartshaadi/types';
import { DestinationForm } from '../../_components/DestinationForm.client';

/**
 * Edit a destination leg (Phase 8 Unit 8.1).
 *
 * Reuses the create form with the leg passed in, rather than a parallel edit
 * component that would drift. The primary-flag checkbox hides itself in edit
 * mode: moving the flag goes through set-primary, which clears the previous
 * primary in one transaction and cannot collide with the partial unique index.
 */
interface PageProps {
  params: Promise<{ id: string; destinationId: string }>;
}

export default async function EditDestinationPage({ params }: PageProps) {
  const { id, destinationId } = await params;
  const t = await getTranslations('weddings.destinations');

  const detail = await fetchAuth<DestinationDetail>(
    `/api/v1/weddings/${id}/destinations/${destinationId}`,
  );
  if (!detail) notFound();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
        <PageHeader
          title={t('editDestination')}
          subtitle={detail.destination.city}
          breadcrumbs={[
            { label: t('heading'), href: `/weddings/${id}/destinations` },
            {
              label: detail.destination.city,
              href: `/weddings/${id}/destinations/${destinationId}`,
            },
            { label: t('editDestination') },
          ]}
        />

        <div className="rounded-2xl border border-gold/20 bg-surface p-5 shadow-card sm:p-6">
          <DestinationForm
            weddingId={id}
            destination={detail.destination}
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
