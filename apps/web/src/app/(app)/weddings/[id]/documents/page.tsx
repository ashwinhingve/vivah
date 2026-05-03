import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { fetchDocuments } from '@/lib/wedding-api';
import { DocumentsClient } from '@/components/wedding/DocumentsClient.client';
import { addDocumentAction, deleteDocumentAction } from './actions';

interface PageProps { params: Promise<{ id: string }> }

export default async function DocumentsPage({ params }: PageProps) {
  const { id } = await params;
  const res = await fetchDocuments(id);
  const docs = res?.documents ?? [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        <Link href={`/weddings/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-4 min-h-[44px]">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2 mb-6">
          <FileText className="h-6 w-6 text-gold" />
          <h1 className="font-heading text-2xl text-primary">Documents</h1>
        </div>
        <DocumentsClient
          weddingId={id}
          initialDocs={docs}
          addAction={addDocumentAction}
          deleteAction={deleteDocumentAction}
        />
      </div>
    </div>
  );
}
