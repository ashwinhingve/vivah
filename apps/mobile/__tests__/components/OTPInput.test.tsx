import { fireEvent, render, screen } from '@testing-library/react-native';
import { OTPInput } from '@/components/OTPInput';

describe('OTPInput', () => {
  it('propagates digits and fires onComplete at 6 digits', async () => {
    const onChangeText = jest.fn();
    const onComplete = jest.fn();
    await render(
      <OTPInput
        value=""
        onChangeText={onChangeText}
        onComplete={onComplete}
        testID="otp"
      />,
    );

    fireEvent.changeText(screen.getByTestId('otp'), '123456');
    expect(onChangeText).toHaveBeenCalledWith('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('strips non-digits and does not complete early', async () => {
    const onChangeText = jest.fn();
    const onComplete = jest.fn();
    await render(
      <OTPInput
        value=""
        onChangeText={onChangeText}
        onComplete={onComplete}
        testID="otp"
      />,
    );

    fireEvent.changeText(screen.getByTestId('otp'), '12a4');
    expect(onChangeText).toHaveBeenCalledWith('124');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('renders one cell per entered digit', async () => {
    await render(
      <OTPInput value="123" onChangeText={jest.fn()} testID="otp" />,
    );

    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });
});
