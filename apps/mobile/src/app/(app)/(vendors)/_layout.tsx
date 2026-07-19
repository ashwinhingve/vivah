import { Stack } from 'expo-router';

/**
 * Vendors stack: browse list -> vendor detail.
 * Headers are off to match the other tab groups; each screen renders its own.
 */
export default function VendorsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
