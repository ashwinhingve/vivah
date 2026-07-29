/**
 * Smoke tests for the design-system primitives introduced by the premium
 * redesign: Badge variants, Avatar initials fallback, and ActionSheet
 * open/press behavior. These guard the shared surface every redesigned
 * screen leans on.
 */
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ReactElement } from 'react';
import { Badge } from '../Badge';
import { Avatar } from '../Avatar';
import { ActionSheet } from '../ActionSheet';
import { SwitchRow } from '../SwitchRow';
import { LedgerRow } from '../LedgerRow';

const INITIAL_METRICS = {
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

async function renderWithSafeArea(ui: ReactElement) {
  return render(<SafeAreaProvider initialMetrics={INITIAL_METRICS}>{ui}</SafeAreaProvider>);
}

describe('Badge', () => {
  it('renders its label for every variant', async () => {
    await render(
      <>
        <Badge label="Verified" variant="successSolid" />
        <Badge label="Pending" variant="warning" />
        <Badge label="New" variant="goldSolid" />
      </>,
    );
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
  });
});

describe('Avatar', () => {
  it('falls back to initials when no photo uri is given', async () => {
    await render(<Avatar name="Alice Johnson" />);
    expect(screen.getByText('AJ')).toBeTruthy();
  });

  it('uses a single initial for one-word names', async () => {
    await render(<Avatar name="Priya" />);
    expect(screen.getByText('P')).toBeTruthy();
  });
});

describe('ActionSheet', () => {
  it('shows title and actions when visible, and runs the pressed action after closing', async () => {
    const onClose = jest.fn();
    const onBlock = jest.fn();
    await renderWithSafeArea(
      <ActionSheet
        visible
        onClose={onClose}
        title="More options"
        actions={[{ label: 'Block profile', destructive: true, onPress: onBlock }]}
      />,
    );

    expect(screen.getByText('More options')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Block profile'));
    expect(onClose).toHaveBeenCalled();
    expect(onBlock).toHaveBeenCalled();
  });

  it('renders nothing when not visible', async () => {
    await renderWithSafeArea(
      <ActionSheet visible={false} onClose={jest.fn()} title="Hidden" actions={[]} />,
    );
    expect(screen.queryByText('Hidden')).toBeNull();
  });
});

describe('SwitchRow', () => {
  it('forwards testID and valueChange to the Switch', async () => {
    const onValueChange = jest.fn();
    await render(
      <SwitchRow
        label="Push notifications"
        description="Alerts on this device"
        value={false}
        onValueChange={onValueChange}
        testID="pref-push"
      />,
    );

    expect(screen.getByText('Push notifications')).toBeTruthy();
    expect(screen.getByText('Alerts on this device')).toBeTruthy();

    fireEvent(screen.getByTestId('pref-push'), 'valueChange', true);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });
});

describe('LedgerRow', () => {
  it('renders title, description and amount', async () => {
    await render(
      <LedgerRow
        title="Refund — Booking"
        description="12 Jul 2026"
        amount="₹5,000"
        amountTone="success"
      />,
    );

    expect(screen.getByText('Refund — Booking')).toBeTruthy();
    expect(screen.getByText('₹5,000')).toBeTruthy();
  });
});
