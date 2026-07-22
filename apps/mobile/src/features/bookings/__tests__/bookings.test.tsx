import { screen } from '@testing-library/react-native';
import { renderScreen } from '../../../test-utils/render';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
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
    api: { bookings: { list: jest.fn(), cancel: jest.fn() } },
    ApiRequestError,
    NetworkError,
  };
});

import { api } from '../../../lib/api';
import BookingsScreen from '../../../app/(app)/bookings';

const list = api.bookings.list as jest.Mock;

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    vendorId: 'v1',
    vendorName: 'Rajwada Palace',
    serviceId: 's1',
    eventDate: '2026-08-15',
    status: 'PENDING',
    totalAmount: 50000,
    escrowAmount: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    packageName: 'Full-day shoot',
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('BookingsScreen', () => {
  it('renders a booking with vendor, status and amount', async () => {
    list.mockResolvedValue({ bookings: [booking()], total: 1, page: 1, limit: 10 });

    await renderScreen(<BookingsScreen />);

    expect(await screen.findByText('Rajwada Palace')).toBeTruthy();
    expect(screen.getByText('PENDING')).toBeTruthy();
    expect(screen.getByText('₹50,000')).toBeTruthy();
    // PENDING is cancellable, so the action must be offered.
    expect(screen.getByText('Cancel booking')).toBeTruthy();
  });

  it('does not offer cancel for a completed booking', async () => {
    list.mockResolvedValue({
      bookings: [booking({ status: 'COMPLETED' })],
      total: 1,
      page: 1,
      limit: 10,
    });

    await renderScreen(<BookingsScreen />);

    expect(await screen.findByText('COMPLETED')).toBeTruthy();
    expect(screen.queryByText('Cancel booking')).toBeNull();
  });

  it('shows an empty state when there are no bookings', async () => {
    list.mockResolvedValue({ bookings: [], total: 0, page: 1, limit: 10 });

    await renderScreen(<BookingsScreen />);

    expect(await screen.findByText('No bookings yet')).toBeTruthy();
  });
});
