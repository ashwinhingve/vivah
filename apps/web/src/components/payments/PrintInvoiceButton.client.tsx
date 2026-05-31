'use client';

/**
 * Print button for the GST invoice page.
 * Lives in a client component because the invoice page itself is a Server
 * Component — passing an inline onClick from an RSC 500s in production.
 */
export function PrintInvoiceButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      aria-label="Print invoice"
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gold/10 transition-colors border-gold text-primary"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      Print Invoice
    </button>
  );
}
