import { EmptyState } from '@/components/ui/EmptyState';

export default function LocaleNotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center bg-background px-4"
    >
      <EmptyState
        variant="no-results"
        title="Page not found"
        description="The page you’re looking for doesn’t exist or may have moved."
        actionLabel="Back to dashboard"
        actionHref="/dashboard"
      />
    </main>
  );
}
