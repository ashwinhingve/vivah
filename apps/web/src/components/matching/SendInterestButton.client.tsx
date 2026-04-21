'use client';

import { useState } from 'react';
import { Loader2, Heart, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const msg =
          typeof body['error'] === 'string' ? body['error'] : 'Could not send interest';
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
      <Button disabled variant="ghost" size="lg" className="flex-1 bg-success/10 text-success hover:bg-success/10">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        Interest Sent
      </Button>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-1">
      <Button
        onClick={handleClick}
        disabled={status === 'loading'}
        variant={status === 'error' ? 'outline' : 'default'}
        size="lg"
        className="w-full"
      >
        {status === 'loading' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Sending…
          </>
        ) : status === 'error' ? (
          <>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try Again
          </>
        ) : (
          <>
            <Heart className="h-4 w-4" aria-hidden="true" />
            Send Interest
          </>
        )}
      </Button>
      {errorMsg ? (
        <p role="alert" className="text-center text-xs text-destructive">
          {errorMsg}
        </p>
      ) : null}
    </div>
  );
}
