'use client';
import { useEffect } from 'react';

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="min-h-screen bg-[#FEFAF6] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-[#E8E0D8] shadow-sm p-6 max-w-sm w-full text-center">
        <p className="font-playfair text-lg text-[#7B2D42] mb-2">Something went wrong</p>
        <p className="text-sm text-[#6B6B76] mb-4">{error.message}</p>
        <button
          onClick={reset}
          className="w-full bg-[#0E7C7B] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#149998] transition-colors min-h-[44px]"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
