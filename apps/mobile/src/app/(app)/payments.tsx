import { useMemo } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Screen } from '../../components/Screen';
import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Eyebrow } from '../../components/Ornament';
import { LedgerRow } from '../../components/LedgerRow';
import { SkeletonRow } from '../../components/Skeleton';
import { ErrorState } from '../../components/States';
import { InfoNote } from '../../components/InfoNote';
import { formatDate, formatINR } from '../../lib/format';
import {
  defaultStatementRange,
  useInvoices,
  useStatement,
  useSubscription,
} from '../../features/payments/hooks';
import { usePlatformSettings } from '@/features/settings/platformSettingsHook';

// The header (with its back circle) is rendered in EVERY state, not just the
// happy one. Dropping it from the loading/error branches would leave a pushed
// route with nothing to press.
const HEADER = <AppHeader title="Payments & Billing" showBack />;

/** Section wrapper: gold eyebrow + staggered entrance. */
function Section({
  eyebrow,
  index,
  children,
}: {
  eyebrow: string;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(index, 8) * 60).duration(300)}
      className="mb-8"
    >
      <Eyebrow text={eyebrow} className="mb-4" />
      {children}
    </Animated.View>
  );
}

/**
 * Payments & billing — Unit 7.1 (mobile parity). READ-ONLY.
 *
 * Shows the current plan, the last 90 days of ledger activity, and invoices.
 * There is no "upgrade" or "cancel" button, and that is a decision rather than
 * an omission: charging for a digital subscription inside the app puts us under
 * Apple IAP / Google Play Billing rules, and Razorpay is still mocked pending
 * the merchant account. Changing a plan stays on the web app.
 */
export default function PaymentsScreen() {
  const platformSettings = usePlatformSettings();

  // Computed once per mount so the window cannot slide underneath a cached key.
  const range = useMemo(() => defaultStatementRange(), []);

  const subscription = useSubscription();
  const statement = useStatement(range.fromDate, range.toDate);
  const invoices = useInvoices();

  const isLoading =
    subscription.isLoading || statement.isLoading || invoices.isLoading;

  // Any one failing sinks the screen: a billing page showing two of three
  // sections with no explanation invites the reader to assume the missing
  // money simply is not there.
  const error = subscription.error ?? statement.error ?? invoices.error;

  if (isLoading) {
    return (
      <Screen>
        {HEADER}
        <Card className="p-0 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </Card>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        {HEADER}
        <ErrorState
          error={error}
          onRetry={() => {
            void subscription.refetch();
            void statement.refetch();
            void invoices.refetch();
          }}
        />
      </Screen>
    );
  }

  const plan = subscription.data;
  const rows = statement.data?.rows ?? [];
  const invoiceItems = invoices.data?.items ?? [];

  return (
    <Screen scroll>
      {HEADER}

      {platformSettings.data?.isMockMode && (
        <InfoNote variant="warning" title="Test Mode" className="mb-6">
          No real charge will be made.
        </InfoNote>
      )}

      {/* ── Current plan ─────────────────────────────────────────────────── */}
      <Section eyebrow="Your Plan" index={0}>
        {plan ? (
          <Card elevated>
            <View className="flex-row items-center justify-between">
              <Text className="font-heading text-xl text-ink">{plan.tier}</Text>
              <Badge
                label={plan.status}
                variant={plan.status === 'ACTIVE' ? 'success' : 'warning'}
              />
            </View>
            <Text className="text-xs text-muted mt-1">{plan.planCode}</Text>
            {formatDate(plan.currentPeriodEnd) ? (
              <Text className="text-sm text-muted mt-3">
                {plan.cancelAtPeriodEnd ? 'Ends on ' : 'Renews on '}
                {formatDate(plan.currentPeriodEnd)}
              </Text>
            ) : null}
          </Card>
        ) : (
          <Card>
            <Text className="text-ink font-semibold">Free plan</Text>
            <Text className="text-sm text-muted mt-1">
              You don&apos;t have an active subscription.
            </Text>
          </Card>
        )}

        <View className="mt-3">
          <InfoNote>Plans are managed on the Smart Shaadi website.</InfoNote>
        </View>
      </Section>

      {/* ── Statement ────────────────────────────────────────────────────── */}
      <Section eyebrow="Activity" index={1}>
        <Text className="text-xs text-muted text-center -mt-2 mb-3">
          {formatDate(range.fromDate)} – {formatDate(range.toDate)}
        </Text>

        {rows.length === 0 ? (
          <Card>
            <Text className="text-sm text-muted">
              No payments or refunds in this period.
            </Text>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            {rows.map((row, index) => (
              // Sign carries the direction — money out is already negative
              // from the server, so formatINR renders the minus itself.
              <LedgerRow
                key={`${row.reference}-${index}`}
                title={row.description}
                description={`${formatDate(row.date)} · ${row.type.replace(/_/g, ' ')}`}
                amount={formatINR(row.amount)}
                amountTone={row.amount < 0 ? 'ink' : 'success'}
                divider={index < rows.length - 1}
              />
            ))}
          </Card>
        )}

        {statement.data ? (
          <View className="flex-row gap-3 mt-3">
            <Card className="flex-1 p-4">
              <Text className="text-xs text-muted">Received</Text>
              <Text className="font-semibold text-success mt-1">
                {formatINR(statement.data.totalIn)}
              </Text>
            </Card>
            <Card className="flex-1 p-4">
              <Text className="text-xs text-muted">Paid</Text>
              <Text className="font-semibold text-ink mt-1">
                {formatINR(statement.data.totalOut)}
              </Text>
            </Card>
          </View>
        ) : null}
      </Section>

      {/* ── Invoices ─────────────────────────────────────────────────────── */}
      <Section eyebrow="Invoices" index={2}>
        {invoiceItems.length === 0 ? (
          <Card>
            <Text className="text-sm text-muted">No invoices yet.</Text>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            {invoiceItems.map((invoice, index) => (
              <LedgerRow
                key={invoice.id}
                title={invoice.invoiceNo}
                description={invoice.vendorName || undefined}
                amount={formatINR(invoice.totalAmount)}
                divider={index < invoiceItems.length - 1}
              />
            ))}
          </Card>
        )}
      </Section>
    </Screen>
  );
}
