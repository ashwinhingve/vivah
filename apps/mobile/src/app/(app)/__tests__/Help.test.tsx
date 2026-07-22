import { screen } from '@testing-library/react-native';
import { renderScreen } from '../../../test-utils/render';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

import HelpScreen from '../help';

describe('HelpScreen', () => {
  it('renders FAQ content and a support contact action', async () => {
    await renderScreen(<HelpScreen />);

    expect(
      await screen.findByText('How does profile verification work?'),
    ).toBeTruthy();
    expect(screen.getByText('Contact support')).toBeTruthy();
    expect(screen.getByText('support@smartshaadi.co.in')).toBeTruthy();
  });
});
