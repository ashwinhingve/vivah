import { Text } from 'react-native';
import { Screen } from '../../../components/Screen';

/** Chat thread — Phase-0 stub, owned by Track C. Realtime via lib/socket.ts. */
export default function ChatThreadScreen() {
  return (
    <Screen>
      <Text className="font-heading text-2xl text-primary">Chat</Text>
      <Text className="mt-2 text-muted">Coming in Sprint I · Track C</Text>
    </Screen>
  );
}
