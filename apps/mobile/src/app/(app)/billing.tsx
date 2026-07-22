import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { SubscriptionPlan } from '@smartshaadi/api-client';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { InfoNote } from '../../components/InfoNote';
import { describeError, ErrorState, LoadingState } from '../../components/States';
import { useThemeColors } from '../../hooks/useThemeColors';
import { withAlpha } from '../../theme/tokens';
import { formatINR } from '../../lib/format';
import {
  usePlans,
  useStartSubscription,
  useSubscription,
} from '../../features/payments/hooks';

/**
 * Subscription / upgrade — reached from Settings → Upgrade to Premium.
 *
 * Payment happens on Razorpay's hosted checkout, NOT in-app: we POST to create
 * the subscription, then open the returned `shortUrl` in an in-app browser tab.
 * Razorpay collects the mandate and its webhook flips the tier on the server, so
 * on return we simply refetch the current subscription. This keeps card data off
 * the device and keeps us clear of Apple/Google in-app-billing rules (a
 * payment-gateway subscription is not a digital IAP).
 *
 * Plan `amount` is in PAISE (unlike on-screen rupee amounts elsewhere), so it is
 * divided by 100 before formatting.
 */
export default function BillingScreen() {
  const router = useRouter();
  const { colors } = useThemeColors();
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  const plans = usePlans();
  const subscription = useSubscription();
  const startSubscription = useStartSubscription();

  const handleSubscribe = useCallback(
    async (plan: SubscriptionPlan) => {
      setPendingCode(plan.code);
      try {
        const result = await startSubscription.mutateAsync(plan.code);
        if (result.shortUrl) {
          await WebBrowser.openBrowserAsync(result.shortUrl);
          // Returned from checkout — the webhook may not have landed yet, so
          // re-read rather than assume success.
          await subscription.refetch();
        } else {
          // Mock mode with no hosted link: nothing to open, just re-read.
          await subscription.refetch();
          Alert.alert(
            'Subscription started',
            'Your plan is being activated. It will reflect here shortly.',
          );
        }
      } catch (err) {
        const { title, message } = describeError(err);
        Alert.alert(title, message);
      } finally {
        setPendingCode(null);
      }
    },
    [startSubscription, subscription],
  );

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

  if (plans.isLoading || subscription.isLoading) {
    return (
      <Screen>
        {backLink}
        <LoadingState label="Loading plans…" />
      </Screen>
    );
  }

  if (plans.isError) {
    return (
      <Screen>
        {backLink}
        <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
      </Screen>
    );
  }

  const activePlanCode = subscription.data?.planCode ?? null;
  const planList = plans.data ?? [];

  return (
    <Screen scroll>
      {backLink}

      <Text className="font-heading text-2xl text-primary mb-2">
        Choose your plan
      </Text>
      <Text className="text-sm text-muted mb-6">
        Upgrade to unlock premium matchmaking features.
      </Text>

      {planList.length === 0 ? (
        <View className="bg-surface border border-gold/20 rounded-xl p-4">
          <Text className="text-sm text-muted">
            No plans are available right now. Please check back later.
          </Text>
        </View>
      ) : (
        planList.map((plan) => {
          const isCurrent = activePlanCode === plan.code;
          const isPending =
            startSubscription.isPending && pendingCode === plan.code;

          return (
            <View
              key={plan.id}
              className="bg-surface border border-gold/40 rounded-2xl p-5 mb-4"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="font-heading text-xl text-primary">
                    {plan.name}
                  </Text>
                  <Text className="text-xs text-muted mt-1 uppercase">
                    {plan.tier} · {plan.interval}
                  </Text>
                </View>
                {isCurrent ? (
                  <View
                    className="px-3 py-1 rounded-full"
                    style={{ backgroundColor: withAlpha(colors.success, '20') }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: colors.success }}
                    >
                      Current
                    </Text>
                  </View>
                ) : null}
              </View>

              <View className="flex-row items-baseline mt-3 mb-4">
                <Text className="font-heading text-2xl text-ink">
                  {formatINR(plan.amount / 100)}
                </Text>
                <Text className="text-sm text-muted ml-1">
                  / {plan.interval.toLowerCase()}
                </Text>
              </View>

              <Button
                title={isCurrent ? 'Your current plan' : `Subscribe`}
                variant={isCurrent ? 'secondary' : 'primary'}
                disabled={isCurrent}
                loading={isPending}
                onPress={() => void handleSubscribe(plan)}
                accessibilityLabel={`Subscribe to ${plan.name}`}
              />
            </View>
          );
        })
      )}

      <View className="mt-2">
        <InfoNote>
          Payment is handled securely by Razorpay. Your plan activates once
          payment is confirmed.
        </InfoNote>
      </View>
    </Screen>
  );
}
