export default function OnboardingLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 rounded-full border-3 border-teal border-t-transparent animate-spin" />
      <p className="text-sm text-muted-foreground">Loading your profile…</p>
    </div>
  );
}
