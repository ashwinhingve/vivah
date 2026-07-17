/**
 * Create B2B Account Page
 *
 * Form to create a new institutional buyer account with GSTIN validation.
 */

import { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { B2BAccountForm } from './form';

export const metadata: Metadata = {
  title: 'Create B2B Account',
  description: 'Register a new institutional buyer account',
};

interface CreateB2BPageProps {
  params: {
    locale: string;
  };
}

export default function CreateB2BPage({ params: { locale } }: CreateB2BPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Create B2B Account"
        subtitle="Register your institutional buyer account for invoicing and contracts"
      />

      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-2xl border border-gold bg-white p-8 shadow-card">
          <B2BAccountForm locale={locale} />
        </div>
      </div>
    </div>
  );
}
