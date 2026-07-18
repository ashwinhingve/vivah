import { Stack } from "expo-router";

/** Matches stack — Track B. Feed → profile detail → requests / shortlist. */
export default function MatchesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
