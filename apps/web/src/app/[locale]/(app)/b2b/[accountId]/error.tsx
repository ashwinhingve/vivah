'use client';

import { RouteErrorBoundary } from '@/components/shared/RouteErrorBoundary.client';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function B2BAccountError({ error, reset }: ErrorProps) {
  return <RouteErrorBoundary error={error} reset={reset} />;
}
