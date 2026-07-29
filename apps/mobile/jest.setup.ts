/**
 * Jest setup — module mocks, registered after the test environment exists.
 * The IS_REACT_ACT_ENVIRONMENT flag is set earlier, in jest.setup.js.
 * Native-only modules (reanimated worklets, haptics) are mocked here for the
 * jsdom-free node env.
 */

// Reanimated's shipped mock still imports the real worklets native module,
// which has no jest counterpart — stub the small API surface we use instead.
jest.mock('react-native-reanimated', () => {
  const { View, Text } = require('react-native');

  // Entering/exiting/layout builders (FadeInDown.delay(80).springify()…) are
  // chainable statics; a self-returning method bag covers any chain order.
  const makeBuilder = () => {
    const builder: Record<string, () => unknown> = {};
    const methods = [
      'duration',
      'delay',
      'springify',
      'damping',
      'stiffness',
      'mass',
      'easing',
      'overshootClamping',
      'withInitialValues',
      'reduceMotion',
      'build',
    ];
    for (const method of methods) {
      builder[method] = () => builder;
    }
    return builder;
  };

  return {
    __esModule: true,
    default: { View, Text, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withSequence: (...steps: unknown[]) => steps[steps.length - 1],
    withRepeat: (v: unknown) => v,
    Easing: {
      ease: (t: number) => t,
      linear: (t: number) => t,
      inOut: (fn: unknown) => fn,
    },
    FadeIn: makeBuilder(),
    FadeInDown: makeBuilder(),
    FadeInUp: makeBuilder(),
    FadeOut: makeBuilder(),
    FadeOutDown: makeBuilder(),
    SlideInDown: makeBuilder(),
    SlideOutDown: makeBuilder(),
    LinearTransition: makeBuilder(),
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Error: 'error', Success: 'success', Warning: 'warning' },
}));
