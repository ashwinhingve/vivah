import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '@/components/Button';

describe('Button', () => {
  it('renders its title and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<Button title="Send OTP" onPress={onPress} />);

    fireEvent.press(screen.getByRole('button', { name: 'Send OTP' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button title="Send OTP" onPress={onPress} disabled />);

    fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('shows a spinner instead of the title while loading', async () => {
    await render(<Button title="Send OTP" loading />);

    expect(screen.queryByText('Send OTP')).toBeNull();
    expect(screen.getByRole('button').props.accessibilityState).toMatchObject({
      busy: true,
      disabled: true,
    });
  });
});
