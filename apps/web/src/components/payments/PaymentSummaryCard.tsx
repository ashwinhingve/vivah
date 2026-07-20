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
    { label: 'Total Spent',     value: formatINR(totalSpend),    colorClass: 'text-primary' },
    { label: 'Refunded',        value: formatINR(totalRefunded), colorClass: 'text-success' },
    { label: 'Wallet Balance',  value: formatINR(walletBalance), colorClass: 'text-teal' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      {items.map(({ label, value, colorClass }) => (
        <div
          key={label}
          className="rounded-2xl bg-surface border border-gold px-4 py-4 text-center shadow-card"
        >
          <p className={`text-lg font-bold sm:text-xl ${colorClass}`}>
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-tight">{label}</p>
        </div>
      ))}
    </div>
  );
}
