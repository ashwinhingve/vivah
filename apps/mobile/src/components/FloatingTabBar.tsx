import { useEffect, useState, type ComponentProps, type ComponentType } from 'react';
import { Keyboard, Platform, Pressable, Text, View } from 'react-native';
import type { Tabs } from 'expo-router';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Heart, Menu, MessageCircle, Store, User, type LucideProps } from 'lucide-react-native';
import { tokens } from '@/theme/tokens';
import { shadowWarmLg } from '@/theme/shadows';
import { useUnreadTotal } from '@/features/chat/useUnreadTotal';

/**
 * FloatingTabBar — the app's floating pill navigation. A detached rounded-full
 * bar hovering above the bottom edge; the active tab expands into a burgundy
 * pill with icon + label (spring layout transition), inactive tabs are outline
 * icons in gold-muted.
 *
 * Renders ONLY the whitelisted tab routes below — every other file in the
 * (app) group (settings, billing, bookings, …) is a stacked utility screen,
 * not a tab. The bar also slides away when the keyboard opens or when the
 * focused tab has pushed a nested detail screen (those get back buttons).
 */
interface TabConfig {
  label: string;
  icon: ComponentType<LucideProps>;
}

const TABS: Record<string, TabConfig> = {
  '(matches)': { label: 'Matches', icon: Heart },
  '(chat)': { label: 'Chat', icon: MessageCircle },
  '(vendors)': { label: 'Vendors', icon: Store },
  '(profile)': { label: 'Profile', icon: User },
  more: { label: 'More', icon: Menu },
};

const HIDE_DISTANCE = 140;

/**
 * expo-router vendors its own copy of the react-navigation bottom-tabs types,
 * which drifts from the standalone package — derive the tabBar prop type from
 * the Tabs component itself so the two can never disagree.
 */
type BottomTabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>['tabBar']>
>[0];

export function FloatingTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const unreadTotal = useUnreadTotal();

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const focusedRoute = state.routes[state.index];
  const focusedConfig = focusedRoute ? TABS[focusedRoute.name] : undefined;
  const nestedDepth = focusedRoute?.state?.index ?? 0;
  // Hidden on: keyboard, non-tab utility screens, or pushed detail screens.
  const hidden = keyboardVisible || !focusedConfig || nestedDepth > 0;

  const hiddenProgress = useSharedValue(0);
  useEffect(() => {
    hiddenProgress.value = withTiming(hidden ? 1 : 0, { duration: 220 });
  }, [hidden, hiddenProgress]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hiddenProgress.value * HIDE_DISTANCE }],
    opacity: 1 - hiddenProgress.value,
  }));

  const tabRoutes = state.routes.filter((route) => TABS[route.name]);

  return (
    <View
      pointerEvents={hidden ? 'none' : 'box-none'}
      style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 12 }}
      className="items-center"
    >
      <Animated.View
        style={[shadowWarmLg, barStyle]}
        className="flex-row items-center gap-1 rounded-full border border-gold/40 bg-surface p-1.5"
      >
        {tabRoutes.map((route) => {
          const config = TABS[route.name];
          if (!config) return null;
          const isFocused = focusedRoute?.key === route.key;
          const IconComponent = config.icon;

          const onPress = () => {
            void Haptics.selectionAsync();
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={`${config.label} tab`}
              accessibilityState={{ selected: isFocused }}
              testID={`tab-${config.label.toLowerCase()}`}
            >
              <Animated.View
                layout={LinearTransition.springify().damping(18).stiffness(240)}
                className={`h-12 flex-row items-center justify-center rounded-full ${
                  isFocused ? 'bg-primary px-5 gap-2' : 'w-12'
                }`}
              >
                <IconComponent
                  size={22}
                  color={isFocused ? tokens.onPrimary : tokens.goldMuted}
                  strokeWidth={isFocused ? 2.4 : 2}
                />
                {route.name === '(chat)' && !isFocused && unreadTotal > 0 ? (
                  <View
                    testID="chat-unread-badge"
                    pointerEvents="none"
                    className="absolute right-1 top-1 h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-primary px-1"
                  >
                    <Text className="text-[10px] font-bold text-on-primary">
                      {unreadTotal > 99 ? '99+' : String(unreadTotal)}
                    </Text>
                  </View>
                ) : null}
                {isFocused ? (
                  <Animated.Text
                    entering={FadeIn.delay(80).duration(160)}
                    exiting={FadeOut.duration(80)}
                    className="text-sm font-semibold text-on-primary"
                  >
                    {config.label}
                  </Animated.Text>
                ) : null}
              </Animated.View>
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}
