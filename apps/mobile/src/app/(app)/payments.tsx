import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { Screen } from '../../components/Screen';
import { ErrorState, LoadingState } from '../../components/States';
import { InfoNote } from '../../components/InfoNote';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatDate, formatINR } from '../../lib/format';
import {
  defaultStatementRange,
  useInvoices,
  useStatement,
  useSubscription,
} from '../../features/payments/hooks';

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
  const router = useRouter();
  const { colors } = useThemeColors();

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

  // The back control is rendered in EVERY state, not just the happy one.
  // Returning a bare <ErrorState> from these branches drops it, which on a
  // pushed route leaves the user on a dead end with nothing to press.
  const backLink = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => router.back()}
      className="mb-4"
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      <Text className="text-sm" style={{ color: colors.teal }}>
        ← Back
      </Text>
    </Pressable>
  );

  if (isLoading) {
    return (
      <Screen>
        {backLink}
        <LoadingState label="Loading your billing…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        {backLink}
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
      {backLink}

      <Text className="font-heading text-2xl text-primary mb-6">
        Payments &amp; Billing
      </Text>

      {/* ── Current plan ─────────────────────────────────────────────────── */}
      <Text className="font-heading text-lg text-primary mb-2">Your plan</Text>
      {plan ? (
        <View className="bg-surface border border-gold/20 rounded-xl p-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-heading text-xl text-ink">{plan.tier}</Text>
            <View
              className="px-2 py-1 rounded-full"
              style={{
                backgroundColor:
                  plan.status === 'ACTIVE'
                    ? `${colors.success}20`
                    : `${colors.warning}20`,
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{
                  color: plan.status === 'ACTIVE' ? colors.success : colors.warning,
                }}
              >
                {plan.status}
              </Text>
            </View>
          </View>
          <Text className="text-xs text-muted mt-1">{plan.planCode}</Text>
          {formatDate(plan.currentPeriodEnd) ? (
            <Text className="text-sm text-muted mt-3">
              {plan.cancelAtPeriodEnd ? 'Ends on ' : 'Renews on '}
              {formatDate(plan.currentPeriodEnd)}
            </Text>
          ) : null}
        </View>
      ) : (
        <View className="bg-surface border border-gold/20 rounded-xl p-4">
          <Text className="text-ink font-semibold">Free plan</Text>
          <Text className="text-sm text-muted mt-1">
            You don&apos;t have an active subscription.
          </Text>
        </View>
      )}

      <View className="mt-3">
        <InfoNote>Plans are managed on the Smart Shaadi website.</InfoNote>
      </View>

      {/* ── Statement ────────────────────────────────────────────────────── */}
      <Text className="font-heading text-lg text-primary mt-8 mb-1">Activity</Text>
      <Text className="text-xs text-muted mb-3">
        {formatDate(range.fromDate)} – {formatDate(range.toDate)}
      </Text>

      {rows.length === 0 ? (
        <View className="bg-surface border border-gold/20 rounded-xl p-4">
          <Text className="text-sm text-muted">
            No payments or refunds in this period.
          </Text>
        </View>
      ) : (
        <View className="bg-surface border border-gold/20 rounded-xl overflow-hidden">
          {rows.map((row, index) => (
            <View
              key={`${row.reference}-${index}`}
              className={`p-4 ${index > 0 ? 'border-t border-gold/20' : ''}`}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-sm font-semibold text-ink">
                    {row.description}
                  </Text>
                  <Text className="text-xs text-muted mt-1">
                    {formatDate(row.date)} · {row.type.replace(/_/g, ' ')}
                  </Text>
                </View>
                {/* Sign carries the direction — money out is already negative
                    from the server, so formatINR renders the minus itself. */}
                <Text
                  className="text-sm font-semibold"
                  style={{ color: row.amount < 0 ? colors.ink : colors.success }}
                >
                  {formatINR(row.amount)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {statement.data ? (
        <View className="flex-row gap-3 mt-3">
          <View className="flex-1 bg-surface border border-gold/20 rounded-xl p-3">
            <Text className="text-xs text-muted">Received</Text>
            <Text className="font-semibold mt-1" style={{ color: colors.success }}>
              {formatINR(statement.data.totalIn)}
            </Text>
          </View>
          <View className="flex-1 bg-surface border border-gold/20 rounded-xl p-3">
            <Text className="text-xs text-muted">Paid</Text>
            <Text className="font-semibold text-ink mt-1">
              {formatINR(statement.data.totalOut)}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── Invoices ─────────────────────────────────────────────────────── */}
      <Text className="font-heading text-lg text-primary mt-8 mb-3">Invoices</Text>
      {invoiceItems.length === 0 ? (
        <View className="bg-surface border border-gold/20 rounded-xl p-4 mb-8">
          <Text className="text-sm text-muted">No invoices yet.</Text>
        </View>
      ) : (
        <View className="mb-8">
          {invoiceItems.map((invoice) => (
            <View
              key={invoice.id}
              className="bg-surface border border-gold/20 rounded-xl p-4 mb-3"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="font-semibold text-ink">
                    {invoice.invoiceNo}
                  </Text>
                  {invoice.vendorName ? (
                    <Text className="text-xs text-muted mt-1">
                      {invoice.vendorName}
                    </Text>
                  ) : null}
                </View>
                <Text className="font-semibold text-ink">
                  {formatINR(invoice.totalAmount)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
