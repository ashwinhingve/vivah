import { ActivityIndicator, Text, View } from 'react-native';
import { ApiRequestError, NetworkError } from '../lib/api';
import { Button } from './Button';
import { tokens } from '../theme/tokens';

/**
 * The three non-happy states every list/detail screen needs.
 *
 * Shared in Phase 0 rather than left to each track, for one reason: if all three
 * tracks roll their own, "something went wrong" ends up phrased three different
 * ways and a 401 gets treated as a retryable blip in one place and a fatal error
 * in another. Error semantics belong in one file.
 */

export function LoadingState({ label }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center py-12">
      <ActivityIndicator size="large" color={tokens.primary} />
      {label ? <Text className="mt-3 text-muted">{label}</Text> : null}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <Text className="font-heading text-xl text-primary text-center">{title}</Text>
      {message ? (
        <Text className="mt-2 text-center text-muted">{message}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <View className="mt-6 w-full">
          <Button title={actionLabel} variant="secondary" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Turns a thrown error into copy a user can act on.
 *
 * `NetworkError` is offered a retry because retrying genuinely can work.
 * A 4xx `ApiRequestError` is not: the server has already decided, and a retry
 * button there just teaches people to jab at a button that will never help.
 */
export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const { title, message, retryable } = describeError(error);

  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <Text className="font-heading text-xl text-primary text-center">{title}</Text>
      <Text className="mt-2 text-center text-muted">{message}</Text>
      {retryable && onRetry ? (
        <View className="mt-6 w-full">
          <Button title="Try again" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

export function describeError(error: unknown): {
  title: string;
  message: string;
  retryable: boolean;
} {
  if (error instanceof NetworkError) {
    return {
      title: "Can't connect",
      message: 'Check your internet connection and try again.',
      retryable: true,
    };
  }

  if (error instanceof ApiRequestError) {
    if (error.isUnauthorized) {
      return {
        title: 'Please sign in again',
        message: 'Your session has expired.',
        retryable: false,
      };
    }
    if (error.isForbidden) {
      return {
        title: 'Not available',
        message: "You don't have access to this.",
        retryable: false,
      };
    }
    // 5xx is worth retrying; the rest is a settled decision by the server.
    return {
      title: 'Something went wrong',
      message: error.message,
      retryable: error.httpStatus >= 500,
    };
  }

  return {
    title: 'Something went wrong',
    message: 'Please try again in a moment.',
    retryable: true,
  };
}
