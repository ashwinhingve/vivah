import { render, screen } from '@testing-library/react-native';
import { Input } from '@/components/Input';

describe('Input', () => {
  it('renders label and hint', async () => {
    await render(
      <Input
        label="Phone Number"
        hint="10 digits, starts with 6-9"
        value=""
        onChangeText={jest.fn()}
      />,
    );

    expect(screen.getByText('Phone Number')).toBeTruthy();
    expect(screen.getByText('10 digits, starts with 6-9')).toBeTruthy();
    expect(screen.getByLabelText('Phone Number')).toBeTruthy();
  });

  it('shows the error message instead of the hint', async () => {
    await render(
      <Input
        label="Phone Number"
        hint="10 digits"
        error="Invalid phone number"
        value="abc"
        onChangeText={jest.fn()}
      />,
    );

    expect(screen.getByText('Invalid phone number')).toBeTruthy();
    expect(screen.queryByText('10 digits')).toBeNull();
  });
});
