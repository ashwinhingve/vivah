import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';
import type { SubscriptionPlan } from '@smartshaadi/api-client';
import { Screen } from '../../components/Screen';
import { AppHeader } from '../../components/AppHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { InfoNote } from '../../components/InfoNote';
import { Skeleton } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { describeError, ErrorState } from '../../components/States';
import { formatINR } from '../../lib/format';
import {
  usePlans,
  useStartSubscription,
  useSubscription,
} from '../../features/payments/hooks';

const HEADER = <AppHeader title="Choose your plan" showBack />;

/** Plan-card-shaped shimmer for the initial load. */
function SkeletonPlanCard() {
  return (
    <Card className="mb-4">
      <Skeleton height={20} width="50%" radius={6} />
      <Skeleton height={12} width="35%" radius={6} className="mt-2" />
      <Skeleton height={26} width="40%" radius={6} className="mt-4" />
      <Skeleton height={44} radius={12} className="mt-4" />
    </Card>
  );
}

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
 * Plan `amount` is already in RUPEES (decimal(12,2) column in the database),
 * so it is displayed directly without conversion.
 */
export default function BillingScreen() {
  const toast = useToast();
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
          toast.show({
            message: 'Subscription started — your plan will reflect here shortly.',
            type: 'success',
          });
        }
      } catch (err) {
        const { title, message } = describeError(err);
        toast.show({ message: `${title}. ${message}`, type: 'error' });
      } finally {
        setPendingCode(null);
      }
    },
    [startSubscription, subscription, toast],
  );

  if (plans.isLoading || subscription.isLoading) {
    return (
      <Screen>
        {HEADER}
        <SkeletonPlanCard />
        <SkeletonPlanCard />
      </Screen>
    );
  }

  if (plans.isError) {
    return (
      <Screen>
        {HEADER}
        <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
      </Screen>
    );
  }

  const activePlanCode = subscription.data?.planCode ?? null;
  const planList = plans.data ?? [];

  return (
    <Screen scroll>
      {HEADER}

      <Text className="text-sm text-muted -mt-3 mb-6">
        Upgrade to unlock premium matchmaking features.
      </Text>

      {planList.length === 0 ? (
        <Card>
          <Text className="text-sm text-muted">
            No plans are available right now. Please check back later.
          </Text>
        </Card>
      ) : (
        planList.map((plan, index) => {
          const isCurrent = activePlanCode === plan.code;
          const isPending =
            startSubscription.isPending && pendingCode === plan.code;

          return (
            <Animated.View
              key={plan.id}
              entering={FadeInUp.delay(Math.min(index, 8) * 60).duration(300)}
            >
              <Card elevated className="mb-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="font-heading text-xl text-primary">
                      {plan.name}
                    </Text>
                    <Text className="text-xs text-muted mt-1 uppercase">
                      {plan.tier} · {plan.interval}
                    </Text>
                  </View>
                  {isCurrent ? <Badge label="Current" variant="success" /> : null}
                </View>

                <View className="flex-row items-baseline mt-3 mb-4">
                  <Text className="font-heading text-2xl text-ink">
                    {formatINR(plan.amount)}
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
              </Card>
            </Animated.View>
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
