import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { WeddingNewForm } from './WeddingNewForm.client';

export default function NewWeddingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8 pb-24">
        <Link
          href="/weddings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Weddings
        </Link>

        <div className="bg-surface border border-gold/20 rounded-xl shadow-card p-6">
          <h1 className="font-heading text-2xl text-primary mb-1">Plan Your Wedding</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Fill in the basics — you can update everything later.
          </p>

          <WeddingNewForm />
        </div>
      </div>
    </div>
  );
}
