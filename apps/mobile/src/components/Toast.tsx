import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react-native';
import { tokens } from '@/theme/tokens';
import { shadowWarmLg } from '@/theme/shadows';

/**
 * Toast — in-app feedback replacing system Alert() for non-blocking messages.
 * One toast at a time; slides up from the bottom (above the floating tab bar)
 * and auto-dismisses. Use ActionSheet for confirmations, this for outcomes.
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  /** Auto-dismiss delay in ms. */
  duration?: number;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Falls back to a no-op outside the provider so screens stay renderable in
 * isolation (feature tests mount screens without the root layout).
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  return ctx ?? { show: () => undefined };
}

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 size={20} color={tokens.success} />,
  error: <XCircle size={20} color={tokens.destructive} />,
  warning: <AlertTriangle size={20} color={tokens.warning} />,
  info: <Info size={20} color={tokens.teal} />,
};

const ACCENT_CLASS: Record<ToastType, string> = {
  success: 'bg-success',
  error: 'bg-destructive',
  warning: 'bg-warning',
  info: 'bg-teal',
};

interface ActiveToast extends Required<Omit<ToastOptions, 'duration'>> {
  id: number;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const show = useCallback(({ message, type = 'info', duration = 3500 }: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    nextId.current += 1;
    setToast({ id: nextId.current, message, type });
    timer.current = setTimeout(() => setToast(null), duration);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={FadeInUp.springify().damping(18)}
          exiting={FadeOutDown.duration(200)}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          className="absolute bottom-28 left-4 right-4 flex-row items-center gap-3 rounded-2xl border border-gold/40 bg-surface p-4"
          style={shadowWarmLg}
        >
          <View className={`w-1 self-stretch rounded-full ${ACCENT_CLASS[toast.type]}`} />
          {ICONS[toast.type]}
          <Text className="flex-1 text-sm font-medium text-ink">{toast.message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}
