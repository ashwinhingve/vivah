import { FileText } from 'lucide-react';
import { fetchDocuments } from '@/lib/wedding-api';
import { DocumentsClient } from '@/components/wedding/DocumentsClient.client';
import { addDocumentAction, deleteDocumentAction } from './actions';

interface PageProps { params: Promise<{ id: string }> }

export default async function DocumentsPage({ params }: PageProps) {
  const { id } = await params;
  const res = await fetchDocuments(id);
  const docs = res?.documents ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
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
