import { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Screen — Phase-1 component.
 * SafeArea-aware container with optional scroll. Outer: full height + ivory bg.
 * Inner: padded View for content.
 * Props: children (required), scroll (optional — wraps in ScrollView).
 */
interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
}

export function Screen({ children, scroll = false }: ScreenProps) {
  const content = (
    <View className="px-6 py-4">
      {children}
    </View>
  );

  if (scroll) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          {content}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {content}
    </SafeAreaView>
  );
}
