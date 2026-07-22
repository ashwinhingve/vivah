import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderScreen } from '../../../test-utils/render';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

const mockOpenBrowserAsync = jest.fn((_url: string) =>
  Promise.resolve({ type: 'dismiss' }),
);
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: (url: string) => mockOpenBrowserAsync(url),
}));

jest.mock('../../../lib/api', () => {
  class ApiRequestError extends Error {
    httpStatus: number;
    code: string;
    constructor(code: string, message: string, httpStatus: number) {
      super(message);
      this.code = code;
      this.httpStatus = httpStatus;
    }
    get isUnauthorized() {
      return this.httpStatus === 401;
    }
    get isForbidden() {
      return this.httpStatus === 403;
    }
  }
  class NetworkError extends Error {}
  return {
    api: {
      payments: {
        getPlans: jest.fn(),
        getSubscription: jest.fn(),
        startSubscription: jest.fn(),
      },
    },
    ApiRequestError,
    NetworkError,
  };
});

import { api } from '../../../lib/api';
import BillingScreen from '../../../app/(app)/billing';

const getPlans = api.payments.getPlans as jest.Mock;
const getSubscription = api.payments.getSubscription as jest.Mock;
const startSubscription = api.payments.startSubscription as jest.Mock;

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-premium-m',
    code: 'PREMIUM_M',
    name: 'Premium Monthly',
    tier: 'PREMIUM',
    interval: 'MONTHLY',
    amount: 49900, // paise → ₹499
    features: {},
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getSubscription.mockResolvedValue(null);
});

describe('BillingScreen', () => {
  it('renders plans with the price converted from paise to rupees', async () => {
    getPlans.mockResolvedValue([plan()]);

    await renderScreen(<BillingScreen />);

    expect(await screen.findByText('Premium Monthly')).toBeTruthy();
    expect(screen.getByText('₹499')).toBeTruthy();
  });

  it('marks the plan the user is already on', async () => {
    getPlans.mockResolvedValue([plan()]);
    getSubscription.mockResolvedValue({
      id: 'sub1',
      status: 'ACTIVE',
      planCode: 'PREMIUM_M',
      tier: 'PREMIUM',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });

    await renderScreen(<BillingScreen />);

    expect(await screen.findByText('Current')).toBeTruthy();
    expect(screen.getByText('Your current plan')).toBeTruthy();
  });

  it('starts a subscription and opens the Razorpay checkout URL', async () => {
    getPlans.mockResolvedValue([plan()]);
    startSubscription.mockResolvedValue({
      subscriptionId: 's1',
      razorpaySubscriptionId: 'rzp_1',
      shortUrl: 'https://rzp.io/checkout/abc',
      status: 'created',
    });

    await renderScreen(<BillingScreen />);
    fireEvent.press(await screen.findByText('Subscribe'));

    await waitFor(() =>
      expect(startSubscription).toHaveBeenCalledWith('PREMIUM_M'),
    );
    await waitFor(() =>
      expect(mockOpenBrowserAsync).toHaveBeenCalledWith(
        'https://rzp.io/checkout/abc',
      ),
    );
  });
});
