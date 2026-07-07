'use client';
import { RouteErrorBoundary } from '@/components/shared/RouteErrorBoundary.client';
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorBoundary error={error} reset={reset} />;
}
