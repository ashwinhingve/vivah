import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Screen } from '../../../components/Screen';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../../components/States';
import { Button } from '../../../components/Button';
import { tokens } from '../../../theme/tokens';
import {
  useReceivedRequests,
  useSentRequests,
  useAcceptRequest,
  useDeclineRequest,
} from '../../../features/matches/hooks';

type Tab = 'received' | 'sent';

/**
 * Get color for request status badge.
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'ACCEPTED':
      return tokens.success;
    case 'PENDING':
      return tokens.warning;
    case 'DECLINED':
    case 'WITHDRAWN':
    case 'BLOCKED':
      return tokens.destructive;
    default:
      return tokens.muted;
  }
}

/**
 * Match Requests Screen — Sprint I Track B.
 *
 * Displays received and sent match requests with a segmented tab toggle.
 * Received requests: Accept / Decline actions
 * Sent requests: Show status (pending, accepted, declined, etc.)
 */
export default function MatchRequestsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('received');
  const [currentPage, setCurrentPage] = useState(1);

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
      } catch {
        alert('Failed to accept request. Please try again.');
      }
    },
    [acceptMutation],
  );

  /**
   * Handle declining a request.
   */
  const handleDecline = useCallback(
    async (requestId: string) => {
      try {
        await declineMutation.mutateAsync(requestId);
      } catch {
        alert('Failed to decline request. Please try again.');
      }
    },
    [declineMutation],
  );

  /**
   * Render a request item card.
   * Note: MatchRequest doesn't include profile details; those come from EnrichedMatchRequest.
   * For now, show the request status and message, which are available in both types.
   */
  const renderRequestCard = useCallback(
    ({ item }: { item: typeof requests[0] }) => (
      <View className="mb-4 rounded-2xl bg-surface p-4 overflow-hidden">
        {/* Request Info */}
        <View className="mb-4">
          <Text className="font-heading text-base text-ink mb-1">
            {activeTab === 'received' ? 'Received' : 'Sent'} Request
          </Text>
          <Text className="text-sm text-muted">
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>

        {/* Message (if any) */}
        {item.message && (
          <View className="mb-4 p-3 bg-background rounded-lg">
            <Text className="text-sm text-ink">"{item.message}"</Text>
          </View>
        )}

        {/* Status Badge */}
        <View className="mb-4 px-3 py-2 bg-background rounded-lg self-start">
          <Text className="text-xs font-semibold" style={{ color: getStatusColor(item.status) }}>
            {item.status}
          </Text>
        </View>

        {/* Actions or Response Info */}
        {activeTab === 'received' ? (
          <View className="flex-row gap-2">
            <Button
              title="Accept"
              onPress={() => handleAccept(item.id)}
              loading={acceptMutation.isPending}
              variant="primary"
            />
            <Button
              title="Decline"
              onPress={() => handleDecline(item.id)}
              loading={declineMutation.isPending}
              variant="secondary"
            />
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
      </View>
    ),
    [activeTab, handleAccept, handleDecline, acceptMutation.isPending, declineMutation.isPending],
  );

  /**
   * Render the segmented tab toggle.
   */
  const renderTabToggle = () => (
    <View className="flex-row mb-4 p-1 bg-background rounded-lg">
      {(['received', 'sent'] as const).map((tab) => (
        <Pressable
          key={tab}
          onPress={() => {
            setActiveTab(tab);
            setCurrentPage(1);
          }}
          className="flex-1 py-2 rounded-md items-center justify-center"
          style={{
            backgroundColor:
              activeTab === tab ? tokens.primary : 'transparent',
          }}
        >
          <Text
            className="font-semibold capitalize"
            style={{
              color:
                activeTab === tab ? '#FFFFFF' : tokens.ink,
            }}
          >
            {tab}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  if (isLoading) {
    return (
      <Screen>
        {renderTabToggle()}
        <LoadingState label="Loading requests..." />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        {renderTabToggle()}
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  if (requests.length === 0) {
    return (
      <Screen>
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
