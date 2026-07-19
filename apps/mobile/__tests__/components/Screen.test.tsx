import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Screen } from '@/components/Screen';

describe('Screen', () => {
  it('renders children in plain mode', async () => {
    await render(
      <Screen>
        <Text>Hello</Text>
      </Screen>,
    );
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('renders children in scroll + keyboardAvoiding mode', async () => {
    await render(
      <Screen scroll keyboardAvoiding>
        <Text>Form content</Text>
      </Screen>,
    );
    expect(screen.getByText('Form content')).toBeTruthy();
  });
});
