import { Stack } from "expo-router";

/** Profile stack — Track A. My profile → edit → onboarding wizard. */
export default function ProfileLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
