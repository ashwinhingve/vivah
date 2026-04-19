'use client';

import { useState } from 'react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function getSessionToken(): string | null {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith('better-auth.session_token='))
    ?.split('=')[1] ?? null;
}

type Status = 'idle' | 'loading' | 'sent' | 'error';

export function SendInterestButton({ profileId }: { profileId: string }) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleClick() {
    setStatus('loading');
    setErrorMsg(null);
    const token = getSessionToken();

    try {
      const res = await fetch(`${API_URL}/api/v1/matchmaking/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Cookie: `better-auth.session_token=${token}` } : {}),
        },
        body: JSON.stringify({ receiverId: profileId }),
        credentials: 'include',
      });

      if (res.status === 409) {
        setStatus('sent');
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        const msg = typeof body['error'] === 'string' ? body['error'] : 'Could not send interest';
        setErrorMsg(msg);
        setStatus('error');
        return;
      }

      setStatus('sent');
    } catch {
      setErrorMsg('Network error — please try again');
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <button
        type="button"
        disabled
        className="flex-1 bg-[#059669] text-white font-semibold rounded-lg py-3 text-sm min-h-[48px] transition-colors opacity-90 cursor-not-allowed"
      >
        Interest Sent ✓
      </button>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'loading'}
        className={`w-full font-semibold rounded-lg py-3 text-sm min-h-[48px] transition-colors ${
          status === 'error'
            ? 'bg-white border-2 border-red-400 text-red-600 hover:bg-red-50'
            : 'bg-[#0E7C7B] hover:bg-[#149998] active:scale-[0.97] text-white'
        } disabled:opacity-70 disabled:cursor-not-allowed`}
      >
        {status === 'loading' ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Sending…
          </span>
        ) : status === 'error' ? 'Try Again' : 'Send Interest'}
      </button>
      {errorMsg && (
        <p className="text-xs text-red-500 text-center">{errorMsg}</p>
      )}
    </div>
  );
}
