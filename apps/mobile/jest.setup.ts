/**
 * Jest setup — module mocks, registered after the test environment exists.
 * The IS_REACT_ACT_ENVIRONMENT flag is set earlier, in jest.setup.js.
 * Native-only modules (reanimated worklets, haptics) are mocked here for the
 * jsdom-free node env.
 */

// Reanimated's shipped mock still imports the real worklets native module,
// which has no jest counterpart — stub the small API surface we use instead.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withSequence: (...steps: unknown[]) => steps[steps.length - 1],
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Error: 'error', Success: 'success', Warning: 'warning' },
}));
