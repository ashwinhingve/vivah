import { useRouter } from 'expo-router';
import { Text, View, Pressable } from 'react-native';
import { Screen } from '../../components/Screen';
import { tokens } from '../../theme/tokens';

interface MenuItem {
  id: string;
  label: string;
  description?: string;
  icon: string;
  onPress: () => void;
}

export default function MoreScreen() {
  const router = useRouter();

  const menuItems: MenuItem[] = [
    {
      id: 'profile',
      label: 'My Profile',
      description: 'View and edit your profile',
      icon: '👤',
      onPress: () => router.push('/(app)/(profile)'),
    },
    {
      id: 'photos',
      label: 'Photos',
      description: 'Manage your photos',
      icon: '📸',
      onPress: () => router.push('/(app)/(profile)'),
    },
    {
      id: 'preferences',
      label: 'Preferences',
      description: 'Update your partner preferences',
      icon: '❤️',
      onPress: () => router.push('/(app)/(profile)/onboarding/preferences'),
    },
    {
      id: 'payments',
      label: 'Payments & Billing',
      description: 'Your plan, activity and invoices',
      icon: '💳',
      onPress: () => router.push('/(app)/payments'),
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Account and subscription settings',
      icon: '⚙️',
      onPress: () => router.push('/(app)/settings'),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      description: 'Manage notification preferences',
      icon: '🔔',
      onPress: () => router.push('/(app)/notifications'),
    },
    {
      id: 'help',
      label: 'Help & Support',
      description: 'FAQs and customer support',
      icon: '❓',
      onPress: () => {
        // Navigation to FAQs/help
      },
    },
  ];

  return (
    <Screen scroll>
      {/* Header */}
      <Text className="font-heading text-2xl text-primary mb-6">More</Text>

      {/* Menu Items */}
      <View className="gap-3 mb-8">
        {menuItems.map((item) => (
          <Pressable
            key={item.id}
            onPress={item.onPress}
            className="flex-row items-center gap-4 bg-surface border border-gold/20 rounded-xl p-4 active:opacity-70"
          >
            <Text className="text-3xl">{item.icon}</Text>
            <View className="flex-1">
              <Text className="font-semibold text-ink">{item.label}</Text>
              {item.description && (
                <Text className="text-xs text-muted mt-1">{item.description}</Text>
              )}
            </View>
            <Text style={{ color: tokens.teal }} className="text-lg">
              →
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Footer info */}
      <View className="bg-gold/10 border border-gold/40 rounded-xl p-4 mt-8">
        <Text className="text-xs text-muted text-center">
          Smart Shaadi • Version 1.0.0
        </Text>
        <Text className="text-xs text-muted text-center mt-2">
          © 2025 Smart Shaadi. All rights reserved.
        </Text>
      </View>
    </Screen>
  );
}
