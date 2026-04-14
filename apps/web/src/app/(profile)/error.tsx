'use client';

export default function ProfileError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#FEFAF6] flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-sm border border-[#E8E0D8] p-6 text-center max-w-sm w-full">
        <p className="text-[#DC2626] text-sm mb-4">
          {error.message || 'Something went wrong'}
        </p>
        <button
          onClick={reset}
          className="bg-[#0E7C7B] hover:bg-[#149998] text-white rounded-lg px-6 py-3 text-sm font-semibold min-h-[44px] w-full transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
