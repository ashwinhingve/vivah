'use client';

import { RouteErrorBoundary } from '@/components/shared/RouteErrorBoundary.client';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function InsuranceError({ error, reset }: Props) {
  return <RouteErrorBoundary error={error} reset={reset} />;
}
