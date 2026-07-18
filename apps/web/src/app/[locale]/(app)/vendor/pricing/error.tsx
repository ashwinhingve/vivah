'use client';

import { RouteErrorBoundary } from '@/components/shared/RouteErrorBoundary.client';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function VendorPricingError({ error, reset }: ErrorPageProps) {
  return <RouteErrorBoundary error={error} reset={reset} />;
}
