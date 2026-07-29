import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Inbox, Send } from 'lucide-react-native';
import { Screen } from '../../../components/Screen';
import { AppHeader } from '../../../components/AppHeader';
import {
  EmptyState,
  ErrorState,
} from '../../../components/States';
import { SkeletonRow } from '../../../components/Skeleton';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Badge, type BadgeVariant } from '../../../components/Badge';
import { useToast } from '../../../components/Toast';
import { tokens } from '../../../theme/tokens';
import {
  useReceivedRequests,
  useSentRequests,
  useAcceptRequest,
  useDeclineRequest,
} from '../../../features/matches/hooks';

type Tab = 'received' | 'sent';

/**
 * Badge variant for a request status.
 */
function getStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'ACCEPTED':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'DECLINED':
    case 'WITHDRAWN':
    case 'BLOCKED':
      return 'error';
    default:
      return 'neutral';
  }
}

/** "ACCEPTED" → "Accepted" for display. */
function humanizeStatus(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/**
 * Match Requests Screen — Sprint I Track B.
 *
 * Received and sent match requests behind an animated segmented control
 * (burgundy pill slides between segments). Received requests offer
 * Accept / Decline; sent requests show status + response metadata.
 */
export default function MatchRequestsScreen() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('received');
  const [currentPage, setCurrentPage] = useState(1);
  const [toggleWidth, setToggleWidth] = useState(0);

  const pillOffset = useSharedValue(0);
  useEffect(() => {
    pillOffset.value = withSpring(activeTab === 'sent' ? toggleWidth / 2 : 0, {
      damping: 18,
      stiffness: 260,
    });
  }, [activeTab, toggleWidth, pillOffset]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillOffset.value }],
  }));

  const receivedQuery = useReceivedRequests(currentPage, 20);
  const sentQuery = useSentRequests(currentPage, 20);

  const acceptMutation = useAcceptRequest();
  const declineMutation = useDeclineRequest();

  const activeQuery = activeTab === 'received' ? receivedQuery : sentQuery;
  const { data, isLoading, isError, error, refetch } = activeQuery;

  const requests = data?.requests ?? [];

  /**
   * Handle accepting a request.
   */
  const handleAccept = useCallback(
    async (requestId: string) => {
      try {
        await acceptMutation.mutateAsync(requestId);
        toast.show({ message: "It's a match! You can now chat.", type: 'success' });
      } catch {
        toast.show({ message: 'Failed to accept request. Please try again.', type: 'error' });
      }
    },
    [acceptMutation, toast],
  );

  /**
   * Handle declining a request.
   */
  const handleDecline = useCallback(
    async (requestId: string) => {
      try {
        await declineMutation.mutateAsync(requestId);
        toast.show({ message: 'Request declined', type: 'info' });
      } catch {
        toast.show({ message: 'Failed to decline request. Please try again.', type: 'error' });
      }
    },
    [declineMutation, toast],
  );

  /**
   * Render a request item card.
   * Note: MatchRequest doesn't include profile details; those come from EnrichedMatchRequest.
   * For now, show the request status and message, which are available in both types.
   */
  const renderRequestCard = useCallback(
    ({ item, index }: { item: typeof requests[0]; index: number }) => (
      <Animated.View entering={FadeInUp.delay(Math.min(index, 6) * 50).duration(350)}>
        <Card className="mb-4 p-5">
          {/* Request Info */}
          <View className="mb-3 flex-row items-start justify-between">
            <View>
              <Text className="font-heading text-base text-primary mb-0.5">
                {activeTab === 'received' ? 'Received request' : 'Sent request'}
              </Text>
              <Text className="text-xs text-muted">
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <Badge variant={getStatusVariant(item.status)} label={humanizeStatus(item.status)} />
          </View>

          {/* Message (if any) — quote block */}
          {item.message && (
            <View className="mb-4 rounded-r-lg border-l-2 border-gold bg-gold/5 p-3">
              <Text className="text-sm italic text-ink">"{item.message}"</Text>
            </View>
          )}

          {/* Actions or Response Info */}
          {activeTab === 'received' ? (
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Button
                  title="Accept"
                  onPress={() => handleAccept(item.id)}
                  loading={acceptMutation.isPending}
                  variant="primary"
                />
              </View>
              <View className="flex-1">
                <Button
                  title="Decline"
                  onPress={() => handleDecline(item.id)}
                  loading={declineMutation.isPending}
                  variant="ghostDestructive"
                />
              </View>
            </View>
          ) : (
            <>
              {item.respondedAt && (
                <Text className="text-xs text-muted">
                  Responded: {new Date(item.respondedAt).toLocaleDateString()}
                </Text>
              )}
              {item.expiresAt && (
                <Text className="text-xs text-muted mt-1">
                  Expires: {new Date(item.expiresAt).toLocaleDateString()}
                </Text>
              )}
            </>
          )}
        </Card>
      </Animated.View>
    ),
    [activeTab, handleAccept, handleDecline, acceptMutation.isPending, declineMutation.isPending],
  );

  /**
   * Animated segmented control — the burgundy pill slides between segments.
   */
  const renderTabToggle = () => (
    <View
      className="mb-5 flex-row rounded-full bg-gold/10 p-1"
      onLayout={(e) => setToggleWidth(e.nativeEvent.layout.width - 8)}
    >
      {toggleWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          className="absolute left-1 top-1 bottom-1 rounded-full bg-primary"
          style={[{ width: toggleWidth / 2 }, pillStyle]}
        />
      )}
      {(['received', 'sent'] as const).map((tab) => {
        const isActive = activeTab === tab;
        const IconComponent = tab === 'received' ? Inbox : Send;
        return (
          <Pressable
            key={tab}
            onPress={() => {
              setActiveTab(tab);
              setCurrentPage(1);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            className="min-h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full"
          >
            <IconComponent size={15} color={isActive ? tokens.onPrimary : tokens.goldMuted} />
            <Text
              className={`font-semibold capitalize ${isActive ? 'text-on-primary' : 'text-gold-muted'}`}
            >
              {tab}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (isLoading) {
    return (
      <Screen>
        <AppHeader title="Requests" showBack />
        {renderTabToggle()}
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <AppHeader title="Requests" showBack />
        {renderTabToggle()}
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  if (requests.length === 0) {
    return (
      <Screen>
        <AppHeader title="Requests" showBack />
        {renderTabToggle()}
        <EmptyState
          title={activeTab === 'received' ? 'No requests yet' : 'No sent requests'}
          message={
            activeTab === 'received'
              ? 'When someone sends you a request, it will appear here.'
              : 'Requests you send will appear here.'
          }
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <AppHeader title="Requests" showBack />
      {renderTabToggle()}
      <FlatList
        data={requests}
        renderItem={renderRequestCard}
        keyExtractor={(item) => item.id}
        scrollIndicatorInsets={{ right: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 20,
        }}
      />
    </Screen>
  );
}
