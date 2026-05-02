/**
 * Smart Shaadi — Payment Summary Card
 * Server Component — receives pre-fetched totals as props.
 */

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface PaymentSummaryCardProps {
  totalSpend:      number;
  totalRefunded:   number;
  walletBalance:   number;
}

export function PaymentSummaryCard({
  totalSpend,
  totalRefunded,
  walletBalance,
}: PaymentSummaryCardProps) {
  const items = [
    { label: 'Total Spent',     value: formatINR(totalSpend),    color: '#7B2D42' },
    { label: 'Refunded',        value: formatINR(totalRefunded), color: '#059669' },
    { label: 'Wallet Balance',  value: formatINR(walletBalance), color: '#0E7C7B' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      {items.map(({ label, value, color }) => (
        <div
          key={label}
          className="rounded-xl bg-surface border px-4 py-4 text-center shadow-sm"
          style={{ borderColor: '#C5A47E' }}
        >
          <p className="text-lg font-bold sm:text-xl" style={{ color }}>
            {value}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground leading-tight">{label}</p>
        </div>
      ))}
    </div>
  );
}
