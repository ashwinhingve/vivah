import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ProfileContentResponse } from '@smartshaadi/types';

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

import EditProfileScreen from '../../../app/(app)/(profile)/edit';
import { api } from '../../../lib/api';
import * as useSessionModule from '../../../hooks/useSession';
import * as useRouterModule from 'expo-router';

describe('EditProfileScreen', () => {
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

  it('loads profile content and displays it in the form', async () => {
    const mockSession = { user: { id: 'user-123' } };
    const mockProfile: ProfileContentResponse = {
      userId: 'user-123',
      personal: {
        fullName: 'John Doe',
        height: 175,
      },
      location: {
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
      },
    } as unknown as ProfileContentResponse;

    const useSessionMock = jest.mocked(useSessionModule.useSession);
    useSessionMock.mockReturnValue({
      data: mockSession,
      isPending: false,
      isError: false,
      error: null,
    } as any);

    const getContentMock = jest.mocked(api.profiles.getContent);
    getContentMock.mockResolvedValue(mockProfile);

    const useRouterMock = jest.mocked(useRouterModule.useRouter);
    useRouterMock.mockReturnValue({
      back: jest.fn(),
      push: jest.fn(),
      replace: jest.fn(),
      navigate: jest.fn(),
      canGoBack: () => true,
    } as any);

    await render(
      <QueryClientProvider client={queryClient}>
        <EditProfileScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('John Doe')).toBeTruthy();
    });

    // Verify the API was called
    expect(getContentMock).toHaveBeenCalled();
  });

  it('renders form fields with loaded profile data', async () => {
    const mockSession = { user: { id: 'user-123' } };
    const mockProfile: ProfileContentResponse = {
      userId: 'user-123',
      personal: { fullName: 'John Doe', height: 175 },
      location: { city: 'Mumbai', state: 'Maharashtra' },
    } as unknown as ProfileContentResponse;

    const useSessionMock = jest.mocked(useSessionModule.useSession);
    useSessionMock.mockReturnValue({
      data: mockSession,
      isPending: false,
      isError: false,
      error: null,
    } as any);

    const getContentMock = jest.mocked(api.profiles.getContent);
    getContentMock.mockResolvedValue(mockProfile);

    const useRouterMock = jest.mocked(useRouterModule.useRouter);
    useRouterMock.mockReturnValue({
      back: jest.fn(),
      push: jest.fn(),
      replace: jest.fn(),
      navigate: jest.fn(),
      canGoBack: () => true,
    } as any);

    await render(
      <QueryClientProvider client={queryClient}>
        <EditProfileScreen />
      </QueryClientProvider>
    );

    // Verify the profile data is loaded and displayed
    await waitFor(() => {
      expect(screen.getByDisplayValue('John Doe')).toBeTruthy();
    });

    expect(screen.getByDisplayValue('175')).toBeTruthy();
    expect(getContentMock).toHaveBeenCalled();
  });

  it('handles loading state while fetching profile', async () => {
    const mockSession = { user: { id: 'user-123' } };

    const useSessionMock = jest.mocked(useSessionModule.useSession);
    useSessionMock.mockReturnValue({
      data: mockSession,
      isPending: false,
      isError: false,
      error: null,
    } as any);

    // Mock getContent to return a pending promise (loading state)
    const getContentMock = jest.mocked(api.profiles.getContent);
    getContentMock.mockImplementation(() => new Promise(() => {}));

    const useRouterMock = jest.mocked(useRouterModule.useRouter);
    useRouterMock.mockReturnValue({
      back: jest.fn(),
      push: jest.fn(),
      replace: jest.fn(),
      navigate: jest.fn(),
      canGoBack: () => true,
    } as any);

    await render(
      <QueryClientProvider client={queryClient}>
        <EditProfileScreen />
      </QueryClientProvider>
    );

    // The loading state should be shown
    expect(screen.getByText('Loading your profile...')).toBeTruthy();
    expect(getContentMock).toHaveBeenCalled();
  });
});
