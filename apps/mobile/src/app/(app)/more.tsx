import { useRouter } from 'expo-router';
import type { ComponentType } from 'react';
import { Text, View, Pressable } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import {
  Bell,
  Calendar,
  Camera,
  ChevronRight,
  CreditCard,
  LifeBuoy,
  Settings,
  SlidersHorizontal,
  User,
  type LucideProps,
} from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { Eyebrow } from '../../components/Ornament';
import { tokens } from '../../theme/tokens';

interface MenuItem {
  id: string;
  label: string;
  description?: string;
  icon: ComponentType<LucideProps>;
  onPress: () => void;
}

export default function MoreScreen() {
  const router = useRouter();

  const menuItems: MenuItem[] = [
    {
      id: 'profile',
      label: 'My Profile',
      description: 'View and edit your profile',
      icon: User,
      onPress: () => router.push('/(app)/(profile)'),
    },
    {
      id: 'photos',
      label: 'Photos',
      description: 'Manage your photos',
      icon: Camera,
      onPress: () => router.push('/(app)/(profile)'),
    },
    {
      id: 'preferences',
      label: 'Preferences',
      description: 'Update your partner preferences',
      icon: SlidersHorizontal,
      onPress: () => router.push('/(app)/(profile)/onboarding/preferences'),
    },
    {
      id: 'bookings',
      label: 'My Bookings',
      description: 'Vendor bookings you have requested',
      icon: Calendar,
      onPress: () => router.push('/(app)/bookings'),
    },
    {
      id: 'payments',
      label: 'Payments & Billing',
      description: 'Your plan, activity and invoices',
      icon: CreditCard,
      onPress: () => router.push('/(app)/payments'),
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Account and subscription settings',
      icon: Settings,
      onPress: () => router.push('/(app)/settings'),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      description: 'Manage notification preferences',
      icon: Bell,
      onPress: () => router.push('/(app)/notifications'),
    },
    {
      id: 'help',
      label: 'Help & Support',
      description: 'FAQs and customer support',
      icon: LifeBuoy,
      onPress: () => router.push('/(app)/help'),
    },
  ];

  return (
    <Screen scroll tabBarInset>
      <AppHeader title="More" />

      {/* Menu — one grouped card with hairline separators */}
      <Card className="p-0 overflow-hidden mb-8">
        {menuItems.map((item, index) => {
          const IconComponent = item.icon;
          return (
            <Animated.View
              key={item.id}
              entering={FadeInUp.delay(Math.min(index, 8) * 40).duration(300)}
            >
              <Pressable
                onPress={item.onPress}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                className={`flex-row items-center gap-4 px-4 py-3.5 active:bg-gold/5 ${
                  index < menuItems.length - 1 ? 'border-b border-gold/15' : ''
                }`}
              >
                <View className="h-11 w-11 items-center justify-center rounded-full bg-gold/15">
                  <IconComponent size={20} color={tokens.goldMuted} strokeWidth={1.75} />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-ink">{item.label}</Text>
                  {item.description && (
                    <Text className="text-xs text-muted mt-0.5">{item.description}</Text>
                  )}
                </View>
                <ChevronRight size={18} color={tokens.teal} />
              </Pressable>
            </Animated.View>
          );
        })}
      </Card>

      {/* Footer brand mark */}
      <View className="items-center pb-4">
        <Text className="font-heading text-lg text-primary mb-2">Smart Shaadi</Text>
        <Eyebrow text="Version 1.0.0" />
        <Text className="text-xs text-muted text-center mt-3">
          © 2025 Smart Shaadi. All rights reserved.
        </Text>
      </View>
    </Screen>
  );
}
