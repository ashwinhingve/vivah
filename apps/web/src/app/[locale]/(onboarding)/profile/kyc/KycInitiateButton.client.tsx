'use client';

import { useState } from 'react';
import { initiateKyc } from '../actions';

export function KycInitiateButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const result = await initiateKyc();
      if (result.authUrl) {
        window.location.href = result.authUrl;
      } else {
        setError(result.error ?? 'Could not start verification. Please try again.');
        setLoading(false);
      }
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 bg-teal hover:bg-teal-hover disabled:opacity-60 text-white font-semibold rounded-lg px-6 py-3.5 min-h-[52px] transition-colors active:scale-[0.98] transition-transform"
      >
        {loading ? (
          <>
            <span className="w-5 h-5 border-2 border-surface/30 border-t-white rounded-full animate-spin" />
            Connecting to DigiLocker…
          </>
        ) : (
          <>
            {/* DigiLocker shield icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            Verify with Aadhaar via DigiLocker
          </>
        )}
      </button>

      {error && (
        <p className="text-sm text-destructive text-center" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
