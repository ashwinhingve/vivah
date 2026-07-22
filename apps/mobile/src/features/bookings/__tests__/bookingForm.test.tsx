import { screen } from '@testing-library/react-native';
import { renderScreen } from '../../../test-utils/render';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ vendorId: 'vendor-1' }),
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
      vendors: { get: jest.fn(), getAvailability: jest.fn() },
      bookings: { create: jest.fn() },
    },
    ApiRequestError,
    NetworkError,
  };
});

import { api } from '../../../lib/api';
import BookingScreen from '../../../app/(app)/booking/[vendorId]';

const get = api.vendors.get as jest.Mock;
const getAvailability = api.vendors.getAvailability as jest.Mock;

function vendor(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vendor-1',
    businessName: 'Rajwada Palace',
    category: 'VENUE',
    city: 'Jaipur',
    state: 'Rajasthan',
    rating: 4.6,
    totalReviews: 32,
    verified: true,
    services: [
      {
        id: 'svc-1',
        name: 'Full-day shoot',
        priceFrom: 62500,
        priceTo: null,
        unit: 'PER_EVENT',
        description: null,
      },
    ],
    tagline: null,
    description: null,
    priceMin: null,
    priceMax: null,
    isFavorite: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getAvailability.mockResolvedValue({ bookedDates: [], blockedDates: [] });
});

describe('BookingScreen (form)', () => {
  it('renders the vendor package to choose from', async () => {
    get.mockResolvedValue(vendor());

    await renderScreen(<BookingScreen />);

    expect(await screen.findByText('Request Booking')).toBeTruthy();
    expect(screen.getByText('Full-day shoot')).toBeTruthy();
    // Submit is present but disabled until a package + date are chosen.
    expect(screen.getByText('Send booking request')).toBeTruthy();
  });

  it('shows an empty state when the vendor has no bookable services', async () => {
    get.mockResolvedValue(vendor({ services: [] }));

    await renderScreen(<BookingScreen />);

    expect(await screen.findByText('No bookable packages')).toBeTruthy();
  });
});
