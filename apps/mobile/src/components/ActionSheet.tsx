import type { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { shadowWarmLg } from '@/theme/shadows';

/**
 * ActionSheet — bottom sheet for menus and destructive confirmations,
 * replacing system Alert()/inline toggle menus. Backdrop fades in, card
 * springs up from the bottom edge. Selecting an action closes the sheet
 * first, then runs the handler.
 */
export interface ActionSheetAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  /** Optional leading icon (~20px, colored by the caller). */
  icon?: ReactNode;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions: ActionSheetAction[];
  cancelLabel?: string;
}

export function ActionSheet({
  visible,
  onClose,
  title,
  message,
  actions,
  cancelLabel = 'Cancel',
}: ActionSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(180)} className="flex-1 bg-black/40">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Dismiss menu" />
        <Animated.View
          entering={SlideInDown.springify().damping(22).stiffness(220)}
          className="rounded-t-3xl bg-surface px-5 pt-3"
          style={[shadowWarmLg, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
        >
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-gold/40" />
          {title ? (
            <Text className="font-heading text-lg text-primary text-center mb-1">{title}</Text>
          ) : null}
          {message ? (
            <Text className="text-sm text-muted text-center mb-2">{message}</Text>
          ) : null}
          <View className="mt-2">
            {actions.map((action, index) => (
              <Pressable
                key={action.label}
                onPress={() => {
                  onClose();
                  action.onPress();
                }}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                className={`min-h-14 flex-row items-center gap-3 px-2 active:bg-gold/10 ${
                  index < actions.length - 1 ? 'border-b border-gold/15' : ''
                }`}
              >
                {action.icon}
                <Text
                  className={`text-base font-semibold ${
                    action.destructive ? 'text-destructive' : 'text-ink'
                  }`}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            className="mt-3 min-h-12 items-center justify-center rounded-xl bg-gold/10 active:bg-gold/20"
          >
            <Text className="text-base font-semibold text-muted">{cancelLabel}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
