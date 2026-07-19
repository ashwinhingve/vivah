import { screen } from '@testing-library/react-native';
import { renderWithQuery } from '../../vendors/__tests__/testUtils';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
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
    api: {
      payments: {
        getInvoices: jest.fn(),
        getStatement: jest.fn(),
        getSubscription: jest.fn(),
      },
    },
    ApiRequestError,
    NetworkError,
  };
});

import { api } from '../../../lib/api';
import PaymentsScreen from '../../../app/(app)/payments';

const getInvoices = api.payments.getInvoices as jest.Mock;
const getStatement = api.payments.getStatement as jest.Mock;
const getSubscription = api.payments.getSubscription as jest.Mock;

function emptyStatement() {
  return {
    userId: 'u1',
    fromDate: '2026-04-20',
    toDate: '2026-07-19',
    rows: [],
    totalIn: 0,
    totalOut: 0,
    closingBalance: 0,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getInvoices.mockResolvedValue({ items: [] });
  getStatement.mockResolvedValue(emptyStatement());
  getSubscription.mockResolvedValue(null);
});

describe('PaymentsScreen', () => {
  it('shows the free plan when the user has no subscription', async () => {
    await renderWithQuery(<PaymentsScreen />);

    expect(await screen.findByText('Free plan')).toBeTruthy();
  });

  it('renders the active plan tier and status from the response', async () => {
    getSubscription.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      planCode: 'PREMIUM_YEARLY',
      tier: 'PREMIUM',
      currentPeriodStart: '2026-01-01T00:00:00.000Z',
      currentPeriodEnd: '2027-01-01T00:00:00.000Z',
      cancelAtPeriodEnd: false,
    });

    await renderWithQuery(<PaymentsScreen />);

    expect(await screen.findByText('PREMIUM')).toBeTruthy();
    expect(screen.getByText('ACTIVE')).toBeTruthy();
    expect(screen.getByText('PREMIUM_YEARLY')).toBeTruthy();
    expect(screen.getByText(/Renews on/)).toBeTruthy();
  });

  it('says "Ends on" rather than "Renews on" when cancelling at period end', async () => {
    getSubscription.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      planCode: 'STANDARD_MONTHLY',
      tier: 'STANDARD',
      currentPeriodStart: '2026-07-01T00:00:00.000Z',
      currentPeriodEnd: '2026-08-01T00:00:00.000Z',
      cancelAtPeriodEnd: true,
    });

    await renderWithQuery(<PaymentsScreen />);

    expect(await screen.findByText(/Ends on/)).toBeTruthy();
    expect(screen.queryByText(/Renews on/)).toBeNull();
  });

  it('renders statement rows and totals as rupees, not paise', async () => {
    getStatement.mockResolvedValue({
      ...emptyStatement(),
      rows: [
        {
          date: '2026-06-01T00:00:00.000Z',
          type: 'PAYMENT',
          description: 'Booking deposit',
          amount: -25000,
          balance: -25000,
          reference: 'pay_1',
        },
      ],
      totalIn: 0,
      totalOut: 25000,
    });

    await renderWithQuery(<PaymentsScreen />);

    expect(await screen.findByText('Booking deposit')).toBeTruthy();
    // 25000 rupees -> "₹25,000". A paise reading would render ₹250.
    expect(screen.getByText('-₹25,000')).toBeTruthy();
    expect(screen.getByText('₹25,000')).toBeTruthy();
  });

  it('renders invoices from the response', async () => {
    getInvoices.mockResolvedValue({
      items: [
        {
          id: 'inv-1',
          invoiceNo: 'SS/2026/0001',
          vendorName: 'Rajwada Palace',
          totalAmount: '118000.00',
        },
      ],
    });

    await renderWithQuery(<PaymentsScreen />);

    expect(await screen.findByText('SS/2026/0001')).toBeTruthy();
    expect(screen.getByText('₹1,18,000')).toBeTruthy();
  });

  it('surfaces an error when any of the three requests fails', async () => {
    getStatement.mockRejectedValue(new Error('boom'));

    await renderWithQuery(<PaymentsScreen />);

    expect(await screen.findByText('Something went wrong')).toBeTruthy();
  });

  // Caught in browser verification, not by the tests above: the error branch
  // returned a bare <ErrorState> and dropped the back control, leaving the user
  // on a screen with nothing to press. Cheap to reintroduce, so pin it.
  it('keeps a way back when the screen is in its error state', async () => {
    getStatement.mockRejectedValue(new Error('boom'));

    await renderWithQuery(<PaymentsScreen />);
    await screen.findByText('Something went wrong');

    expect(screen.getByLabelText('Back')).toBeTruthy();
  });

  it('offers no way to change the plan from mobile', async () => {
    await renderWithQuery(<PaymentsScreen />);
    await screen.findByText('Free plan');

    // Store-policy constraint, not an oversight — see PaymentEndpoints.
    expect(screen.queryByText(/Upgrade/i)).toBeNull();
    expect(screen.queryByText(/Cancel/i)).toBeNull();
  });
});
