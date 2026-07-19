import { ReactElement, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControlProps,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Screen — SafeArea-aware page container with optional scroll, keyboard
 * avoidance (for form screens), and pull-to-refresh passthrough.
 * Standard padding px-6 py-8; ivory/near-black background via tokens.
 */
interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  keyboardAvoiding?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  contentClassName?: string;
}

export function Screen({
  children,
  scroll = false,
  keyboardAvoiding = false,
  refreshControl,
  contentClassName = 'px-6 py-8',
}: ScreenProps) {
  let body: ReactNode = scroll ? (
    <ScrollView
      contentContainerClassName={`grow ${contentClassName}`}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View className={`flex-1 ${contentClassName}`}>{children}</View>
  );

  if (keyboardAvoiding) {
    body = (
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {body}
      </KeyboardAvoidingView>
    );
  }

  return <SafeAreaView className="flex-1 bg-background">{body}</SafeAreaView>;
}
