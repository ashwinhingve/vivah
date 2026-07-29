/**
 * FloatingTabBar — the whitelist is the structural fix for the junk-tabs bug
 * (utility routes in the (app) group rendering as tabs). These tests pin that
 * only the five real tabs render, and that pressing one navigates.
 */
import { render, screen, fireEvent } from '@testing-library/react-native';
import { FloatingTabBar } from '../FloatingTabBar';
import { useUnreadTotal } from '../../features/chat/useUnreadTotal';

jest.mock('../../features/chat/useUnreadTotal', () => ({
  useUnreadTotal: jest.fn(() => 0),
}));

type TabBarProps = Parameters<typeof FloatingTabBar>[0];

function makeProps(overrides?: { index?: number }): TabBarProps {
  const routeNames = [
    '(matches)',
    '(chat)',
    '(vendors)',
    '(profile)',
    'more',
    // Utility screens that once leaked into the bar:
    'settings',
    'billing',
    'bookings',
    'help',
  ];
  const navigation = {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
  };
  return {
    state: {
      index: overrides?.index ?? 0,
      routes: routeNames.map((name) => ({ key: `${name}-key`, name })),
    },
    navigation,
    insets: { top: 0, left: 0, right: 0, bottom: 0 },
    descriptors: {},
  } as unknown as TabBarProps;
}

describe('FloatingTabBar', () => {
  it('renders exactly the five whitelisted tabs, never utility routes', async () => {
    await render(<FloatingTabBar {...makeProps()} />);

    for (const label of ['Matches', 'Chat', 'Vendors', 'Profile', 'More']) {
      expect(screen.getByLabelText(`${label} tab`)).toBeTruthy();
    }
    // The whole bar exposes exactly five tab buttons — junk routes add none.
    expect(screen.getAllByLabelText(/ tab$/)).toHaveLength(5);
    expect(screen.queryByTestId('tab-settings')).toBeNull();
    expect(screen.queryByTestId('tab-billing')).toBeNull();
  });

  it('navigates to the pressed tab when it is not focused', async () => {
    const props = makeProps({ index: 0 });
    await render(<FloatingTabBar {...props} />);

    await fireEvent.press(screen.getByTestId('tab-chat'));

    const navigation = props.navigation as unknown as {
      emit: jest.Mock;
      navigate: jest.Mock;
    };
    expect(navigation.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tabPress', target: '(chat)-key' }),
    );
    expect(navigation.navigate).toHaveBeenCalledWith('(chat)', undefined);
  });

  it('shows the unread badge on the Chat tab when there are unread messages', async () => {
    (useUnreadTotal as jest.Mock).mockReturnValue(3);
    await render(<FloatingTabBar {...makeProps({ index: 0 })} />);

    expect(screen.getByTestId('chat-unread-badge')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('caps the badge label at 99+', async () => {
    (useUnreadTotal as jest.Mock).mockReturnValue(140);
    await render(<FloatingTabBar {...makeProps({ index: 0 })} />);

    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('hides the badge when there are no unreads', async () => {
    (useUnreadTotal as jest.Mock).mockReturnValue(0);
    await render(<FloatingTabBar {...makeProps({ index: 0 })} />);

    expect(screen.queryByTestId('chat-unread-badge')).toBeNull();
  });

  it('hides the badge while the Chat tab is focused', async () => {
    (useUnreadTotal as jest.Mock).mockReturnValue(3);
    await render(<FloatingTabBar {...makeProps({ index: 1 })} />); // (chat) is index 1

    expect(screen.queryByTestId('chat-unread-badge')).toBeNull();
  });
});
