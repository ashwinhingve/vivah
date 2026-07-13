import { FileText } from 'lucide-react';
import { fetchDocuments } from '@/lib/wedding-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { DocumentsClient } from '@/components/wedding/DocumentsClient.client';
import { addDocumentAction, deleteDocumentAction } from './actions';

interface PageProps { params: Promise<{ id: string }> }

export default async function DocumentsPage({ params }: PageProps) {
  const { id } = await params;
  const res = await fetchDocuments(id);
  const docs = res?.documents ?? [];

  return (
    <PageTransition>
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
          <PageHeader
            title="Documents"
            description="Store marriage certificates, legal documents, and important files."
          />
          <DocumentsClient
            weddingId={id}
            initialDocs={docs}
            addAction={addDocumentAction}
            deleteAction={deleteDocumentAction}
          />
        </div>
      </main>
    </PageTransition>
  );
}
