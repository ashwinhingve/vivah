'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = 'none' | 'sent_pending' | 'received_pending' | 'matched' | 'sending' | 'declined' | 'error';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Props {
  profileId: string;
  initialStatus: 'none' | 'sent_pending' | 'received_pending' | 'matched';
  requestId: string | null;
}

export function MatchActionBar({ profileId, initialStatus, requestId }: Props) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(requestId);
  const router = useRouter();

  async function sendInterest() {
    setStatus('sending');
    try {
      const res = await fetch(`${API_URL}/api/v1/matchmaking/requests`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: profileId }),
      });
      const json = (await res.json()) as { data?: { id?: string } };
      if (res.ok) setActiveRequestId(json.data?.id ?? null);
      if (res.ok || res.status === 409) { setStatus('sent_pending'); return; }
      setStatus('error');
    } catch {
      setStatus('error');
    }
  }

  async function acceptInterest() {
    if (!activeRequestId) return;
    setStatus('sending');
    try {
      const res = await fetch(`${API_URL}/api/v1/matchmaking/requests/${activeRequestId}/accept`, {
        method: 'PUT',
        credentials: 'include',
      });
      if (res.ok) { router.push(`/chat/${activeRequestId}`); return; }
      setStatus('received_pending');
    } catch {
      setStatus('received_pending');
    }
  }

  async function declineInterest() {
    if (!activeRequestId) return;
    setStatus('sending');
    try {
      const res = await fetch(`${API_URL}/api/v1/matchmaking/requests/${activeRequestId}/decline`, {
        method: 'PUT',
        credentials: 'include',
      });
      if (res.ok) { setStatus('declined'); return; }
      setStatus('received_pending');
    } catch {
      setStatus('received_pending');
    }
  }

  if (status === 'matched' && activeRequestId) {
    return (
      <Link
        href={`/chat/${activeRequestId}`}
        className="flex-1 h-11 rounded-lg bg-teal text-white font-semibold text-sm flex items-center justify-center hover:bg-teal-hover transition-colors"
      >
        Open Chat
      </Link>
    );
  }

  if (status === 'received_pending') {
    return (
      <>
        <button
          type="button"
          onClick={acceptInterest}
          className="flex-1 h-11 rounded-lg bg-success text-white font-semibold text-sm flex items-center justify-center hover:bg-success/90 transition-colors"
        >
          Accept Interest
        </button>
        <button
          type="button"
          onClick={declineInterest}
          className="flex-1 h-11 rounded-lg border border-destructive text-destructive font-semibold text-sm flex items-center justify-center hover:bg-destructive/5 transition-colors"
        >
          Decline
        </button>
      </>
    );
  }

  if (status === 'sent_pending') {
    return (
      <button
        type="button"
        disabled
        className="flex-1 h-11 rounded-lg bg-success/15 text-success font-semibold text-sm flex items-center justify-center cursor-not-allowed"
      >
        Interest Sent ✓
      </button>
    );
  }

  if (status === 'declined') {
    return (
      <button
        type="button"
        disabled
        className="flex-1 h-11 rounded-lg bg-muted text-muted-foreground font-semibold text-sm flex items-center justify-center cursor-not-allowed"
      >
        Interest Declined
      </button>
    );
  }

  if (status === 'sending') {
    return (
      <button
        type="button"
        disabled
        className="flex-1 h-11 rounded-lg bg-teal/50 text-white font-semibold text-sm flex items-center justify-center cursor-not-allowed"
      >
        Please wait…
      </button>
    );
  }

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={sendInterest}
        className="flex-1 h-11 rounded-lg border-2 border-destructive text-destructive font-semibold text-sm flex items-center justify-center hover:bg-destructive/5 transition-colors"
      >
        Try Again
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={sendInterest}
      className="flex-1 h-11 rounded-lg bg-teal text-white font-semibold text-sm flex items-center justify-center hover:bg-teal-hover transition-colors"
    >
      Send Interest
    </button>
  );
}
