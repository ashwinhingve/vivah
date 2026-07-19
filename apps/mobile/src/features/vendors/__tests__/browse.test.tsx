import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithQuery, vendorFixture } from './testUtils';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useFocusEffect: jest.fn(),
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
    api: { vendors: { list: jest.fn() } },
    ApiRequestError,
    NetworkError,
  };
});

import { api } from '../../../lib/api';
import VendorBrowseScreen from '../../../app/(app)/(vendors)/index';

const list = api.vendors.list as jest.Mock;

function page(vendors: unknown[], meta = { page: 1, total: vendors.length, limit: 20 }) {
  return { vendors, meta };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('VendorBrowseScreen', () => {
  it('renders vendors from the response', async () => {
    list.mockResolvedValue(
      page([
        vendorFixture(),
        vendorFixture({
          id: 'vendor-2',
          businessName: 'Lotus Caterers',
          city: 'Pune',
          state: 'Maharashtra',
        }),
      ]),
    );

    await renderWithQuery(<VendorBrowseScreen />);

    expect(await screen.findByText('Rajwada Palace')).toBeTruthy();
    expect(await screen.findByText('Lotus Caterers')).toBeTruthy();
    expect(screen.getByText('Jaipur, Rajasthan')).toBeTruthy();
  });

  it('renders the price band from the response, not a placeholder', async () => {
    list.mockResolvedValue(page([vendorFixture()]));

    await renderWithQuery(<VendorBrowseScreen />);

    // 250000 -> "₹2.50 L", 800000 -> "₹8 L" via the lakh formatter, matching
    // exactly what the web app renders for the same vendor.
    expect(await screen.findByText('₹2.50 L – ₹8 L')).toBeTruthy();
  });

  it('shows "Price on request" when the vendor has no price band', async () => {
    list.mockResolvedValue(
      page([vendorFixture({ priceMin: null, priceMax: null })]),
    );

    await renderWithQuery(<VendorBrowseScreen />);

    expect(await screen.findByText('Price on request')).toBeTruthy();
  });

  it('does not show a 0.0 star rating for an unrated vendor', async () => {
    list.mockResolvedValue(
      page([vendorFixture({ rating: 0, totalReviews: 0 })]),
    );

    await renderWithQuery(<VendorBrowseScreen />);

    expect(await screen.findByText('No reviews yet')).toBeTruthy();
    expect(screen.queryByText(/★ 0\.0/)).toBeNull();
  });

  it('re-queries with the category filter when a chip is tapped', async () => {
    list.mockResolvedValue(page([vendorFixture()]));

    await renderWithQuery(<VendorBrowseScreen />);
    await screen.findByText('Rajwada Palace');

    fireEvent.press(screen.getByText('Catering'));

    // The filter must reach the SERVER, not just filter the loaded page.
    await screen.findByText('Rajwada Palace');
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'CATERING' }),
    );
  });

  it('navigates to the vendor detail route on tap', async () => {
    list.mockResolvedValue(page([vendorFixture()]));

    await renderWithQuery(<VendorBrowseScreen />);
    fireEvent.press(await screen.findByTestId('vendor-card-vendor-1'));

    expect(mockPush).toHaveBeenCalledWith('/(app)/(vendors)/vendor-1');
  });

  it('shows the empty state when the API returns no vendors', async () => {
    list.mockResolvedValue(page([]));

    await renderWithQuery(<VendorBrowseScreen />);

    expect(await screen.findByText('No vendors found')).toBeTruthy();
  });

  it('shows an error state when the request fails', async () => {
    list.mockRejectedValue(new Error('boom'));

    await renderWithQuery(<VendorBrowseScreen />);

    expect(await screen.findByText('Something went wrong')).toBeTruthy();
  });
});
