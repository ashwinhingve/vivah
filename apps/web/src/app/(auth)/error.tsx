'use client';

export default function AuthError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="bg-surface rounded-xl shadow-sm border border-border p-6 text-center max-w-sm w-full">
        <p className="text-destructive text-sm mb-4">
          {error.message || 'Something went wrong'}
        </p>
        <button
          onClick={reset}
          className="bg-teal hover:bg-teal-hover text-white rounded-lg px-6 py-3 text-sm font-semibold min-h-[44px] w-full transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
