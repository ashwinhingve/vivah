import { screen } from '@testing-library/react-native';
import { renderWithQuery, vendorFixture } from './testUtils';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
  useFocusEffect: jest.fn(),
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
      vendors: {
        get: jest.fn(),
        getReviews: jest.fn(),
        toggleFavorite: jest.fn(),
      },
    },
    ApiRequestError,
    NetworkError,
  };
});

import { api } from '../../../lib/api';
import VendorDetailScreen from '../../../app/(app)/(vendors)/[vendorId]';

const get = api.vendors.get as jest.Mock;
const getReviews = api.vendors.getReviews as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  getReviews.mockResolvedValue({ reviews: [] });
});

describe('VendorDetailScreen', () => {
  it('renders the vendor from the response', async () => {
    get.mockResolvedValue(vendorFixture());

    await renderWithQuery(<VendorDetailScreen />);

    expect(await screen.findByText('Rajwada Palace')).toBeTruthy();
    expect(screen.getByText('Jaipur, Rajasthan')).toBeTruthy();
    expect(screen.getByText('₹2.50 L – ₹8 L')).toBeTruthy();
  });

  it('labels the save button by current favourite state', async () => {
    get.mockResolvedValue(vendorFixture({ isFavorite: true }));

    await renderWithQuery(<VendorDetailScreen />);

    expect(await screen.findByText('Saved')).toBeTruthy();
  });

  it('renders service prices from the response', async () => {
    get.mockResolvedValue(
      vendorFixture({
        services: [
          {
            id: 'svc-1',
            name: 'Full-day shoot',
            priceFrom: 62500,
            priceTo: 113500,
            unit: 'PER_EVENT',
            description: null,
          },
        ],
      }),
    );

    await renderWithQuery(<VendorDetailScreen />);

    expect(await screen.findByText('Full-day shoot')).toBeTruthy();
    expect(screen.getByText('₹62,500 – ₹1,13,500')).toBeTruthy();
  });

  // Caught in browser verification. This is a PUSHED route with no tab bar
  // behind it, so an error branch without the back control is a dead end.
  it('keeps a way back when the vendor fails to load', async () => {
    get.mockRejectedValue(new Error('boom'));

    await renderWithQuery(<VendorDetailScreen />);
    await screen.findByText('Something went wrong');

    expect(screen.getByLabelText('Back to vendors')).toBeTruthy();
  });
});
