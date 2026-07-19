import { render, waitFor, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ProfileMetaResponse } from '@smartshaadi/types';

// Mock expo-router FIRST (highest level dependency)
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

// Mock hooks
jest.mock('../../../hooks/useSession', () => ({
  useSession: jest.fn(),
}));

// Mock api
jest.mock('../../../lib/api', () => ({
  api: {
    profiles: {
      getContent: jest.fn(),
      updateContentSection: jest.fn(),
      getMe: jest.fn(),
      getStrengthTips: jest.fn(),
    },
  },
}));

import MyProfileScreen from '../../../app/(app)/(profile)/index';
import { api } from '../../../lib/api';
import * as useSessionModule from '../../../hooks/useSession';

describe('MyProfileScreen', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    jest.clearAllMocks();
  });

  it('fetches and displays profile metadata', async () => {
    const mockSession = { user: { id: 'user-123' } };
    const mockProfile: ProfileMetaResponse = {
      id: 'profile-123',
      userId: 'user-123',
      name: 'John Doe',
      role: 'INDIVIDUAL',
      status: 'ACTIVE',
      phoneNumber: '+91234567890',
      email: 'john@example.com',
      verificationStatus: 'VERIFIED',
      premiumTier: 'PREMIUM',
      profileCompleteness: 85,
      isActive: true,
      stayQuotient: null,
      familyInclinationScore: null,
      functionAttendanceScore: null,
      photos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockStrength = { tips: ['Complete your horoscope'], score: 85 };

    const useSessionMock = jest.mocked(useSessionModule.useSession);
    useSessionMock.mockReturnValue({
      data: mockSession,
      isPending: false,
      isError: false,
      error: null,
    } as any);

    const getMaxMock = jest.mocked(api.profiles.getMe);
    getMaxMock.mockResolvedValue(mockProfile);

    const getStrengthMock = jest.mocked(api.profiles.getStrengthTips);
    getStrengthMock.mockResolvedValue(mockStrength);

    await render(
      <QueryClientProvider client={queryClient}>
        <MyProfileScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeTruthy();
    });

    expect(screen.getByText('85%')).toBeTruthy();
  });

  it('calls getMe and getStrengthTips APIs', async () => {
    const mockSession = { user: { id: 'user-123' } };
    const mockProfile: ProfileMetaResponse = {
      id: 'profile-123',
      userId: 'user-123',
      name: 'John Doe',
      role: 'INDIVIDUAL',
      status: 'ACTIVE',
      phoneNumber: null,
      email: null,
      verificationStatus: 'PENDING',
      premiumTier: 'STANDARD',
      profileCompleteness: 50,
      isActive: true,
      stayQuotient: null,
      familyInclinationScore: null,
      functionAttendanceScore: null,
      photos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockStrength = { tips: [], score: 50 };

    const useSessionMock = jest.mocked(useSessionModule.useSession);
    useSessionMock.mockReturnValue({
      data: mockSession,
      isPending: false,
      isError: false,
      error: null,
    } as any);

    const getMeMock = jest.mocked(api.profiles.getMe);
    getMeMock.mockResolvedValue(mockProfile);

    const getStrengthMock = jest.mocked(api.profiles.getStrengthTips);
    getStrengthMock.mockResolvedValue(mockStrength);

    await render(
      <QueryClientProvider client={queryClient}>
        <MyProfileScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(getMeMock).toHaveBeenCalled();
      expect(getStrengthMock).toHaveBeenCalled();
    });
  });

  it('shows loading state initially', async () => {
    const mockSession = { user: { id: 'user-123' } };

    const useSessionMock = jest.mocked(useSessionModule.useSession);
    useSessionMock.mockReturnValue({
      data: mockSession,
      isPending: false,
      isError: false,
      error: null,
    } as any);

    const getMeMock = jest.mocked(api.profiles.getMe);
    getMeMock.mockImplementation(() => new Promise(() => {}));

    await render(
      <QueryClientProvider client={queryClient}>
        <MyProfileScreen />
      </QueryClientProvider>
    );

    expect(screen.getByText('Loading your profile...')).toBeTruthy();
  });
});
