'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MeetingSchedule } from '@smartshaadi/types';

const API_BASE = process.env['NEXT_PUBLIC_SOCKET_URL'] ?? 'http://localhost:4000';

interface VideoCallProps {
  matchId: string;
  /** Better Auth userId — used for identity checks where proposedByUserId is available.
   *  For proposedBy (profileId) comparisons, the component resolves currentProfileId internally.
   */
  currentUserId: string;
}

type MeetingStatus = MeetingSchedule['status'];

function statusBadge(status: MeetingStatus) {
  const styles: Record<MeetingStatus, string> = {
    PROPOSED:  'bg-amber-100 text-amber-800',
    CONFIRMED: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-secondary text-muted-foreground',
    CANCELLED: 'bg-destructive/15 text-destructive',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function VideoCall({ matchId, currentUserId }: VideoCallProps) {
  // ── State ───────────────────────────────────────────────────────────────────
  const [meetings, setMeetings]           = useState<MeetingSchedule[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [meetingsError, setMeetingsError] = useState<string | null>(null);

  // FIX 5: Resolve currentProfileId (profiles.id) so we can compare against
  // meeting.proposedBy (which is a profileId, NOT a Better Auth userId).
  // Without this, isProposer is always false because the namespaces differ.
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);

  // Instant call
  const [callingRoom, setCallingRoom]     = useState(false);
  const [callError, setCallError]         = useState<string | null>(null);

  // Schedule form
  const [showSchedule, setShowSchedule]   = useState(false);
  const [scheduledAt, setScheduledAt]     = useState('');
  const [durationMin, setDurationMin]     = useState(60);
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduling, setScheduling]       = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Respond
  const [responding, setResponding]       = useState<string | null>(null); // meetingId being responded to

  // ── Resolve currentProfileId on mount ──────────────────────────────────────
  useEffect(() => {
    if (!currentUserId) return;
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/profiles/me`, {
          credentials: 'include',
        });
        if (res.ok) {
          const json = (await res.json()) as { success: boolean; data?: { id?: string } };
          if (json.success && json.data?.id) {
            setCurrentProfileId(json.data.id);
          }
        }
      } catch {
        // Non-fatal — fallback: isProposer will be false for all meetings,
        // meaning the respondent buttons show to everyone, but the API
        // will still reject the proposer with 403. UX degrades gracefully.
      }
    })();
  }, [currentUserId]);

  // ── Fetch meetings ──────────────────────────────────────────────────────────
  const fetchMeetings = useCallback(async () => {
    setLoadingMeetings(true);
    setMeetingsError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/video/meetings/${matchId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load meetings');
      const json = (await res.json()) as { success: boolean; data: MeetingSchedule[] };
      setMeetings(json.success ? json.data : []);
    } catch (e) {
      setMeetingsError((e as Error).message);
    } finally {
      setLoadingMeetings(false);
    }
  }, [matchId]);

  useEffect(() => { void fetchMeetings(); }, [fetchMeetings]);

  // ── Start instant call ──────────────────────────────────────────────────────
  async function handleStartCall() {
    setCallingRoom(true);
    setCallError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/video/rooms`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, durationMin: 60 }),
      });
      const json = (await res.json()) as { success: boolean; data: { roomUrl: string }; error?: { message: string } };
      if (!json.success || !json.data?.roomUrl) {
        throw new Error(json.error?.message ?? 'Could not start call');
      }
      window.open(json.data.roomUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setCallError((e as Error).message);
    } finally {
      setCallingRoom(false);
    }
  }

  // ── Schedule meeting ────────────────────────────────────────────────────────
  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledAt) { setScheduleError('Please pick a date and time'); return; }
    setScheduling(true);
    setScheduleError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/video/meetings`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          scheduledAt: new Date(scheduledAt).toISOString(),
          durationMin,
          notes: scheduleNotes || undefined,
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: { message: string } };
      if (!json.success) throw new Error(json.error?.message ?? 'Could not schedule meeting');
      setShowSchedule(false);
      setScheduledAt('');
      setScheduleNotes('');
      setDurationMin(60);
      await fetchMeetings();
    } catch (e) {
      setScheduleError((e as Error).message);
    } finally {
      setScheduling(false);
    }
  }

  // ── Respond to meeting ──────────────────────────────────────────────────────
  async function handleRespond(meetingId: string, status: 'CONFIRMED' | 'CANCELLED') {
    setResponding(meetingId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/video/meetings/${matchId}/${meetingId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json()) as { success: boolean };
      if (!json.success) throw new Error('Could not update meeting');
      await fetchMeetings();
    } catch {
      // Non-fatal — refresh anyway
      await fetchMeetings();
    } finally {
      setResponding(null);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <section className="border-t border-border bg-surface px-4 py-4 space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleStartCall}
          disabled={callingRoom}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-[#0E7C7B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a6564] disabled:opacity-60 transition-colors"
        >
          {callingRoom ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          )}
          {callingRoom ? 'Starting…' : 'Start Video Call'}
        </button>

        <button
          onClick={() => setShowSchedule(v => !v)}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#0E7C7B] px-4 py-2 text-sm font-semibold text-[#0E7C7B] hover:bg-[#0E7C7B]/5 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {showSchedule ? 'Cancel' : 'Schedule Call'}
        </button>
      </div>

      {callError && (
        <p role="alert" className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">
          {callError}
        </p>
      )}

      {/* Schedule form */}
      {showSchedule && (
        <form onSubmit={handleSchedule} className="rounded-xl border border-border bg-secondary p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[#0F172A]">Schedule a video call</h3>

          <div className="flex flex-col gap-1">
            <label htmlFor="scheduled-at" className="text-xs font-medium text-muted-foreground">Date &amp; Time</label>
            <input
              id="scheduled-at"
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="min-h-[44px] rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="duration" className="text-xs font-medium text-muted-foreground">Duration</label>
            <select
              id="duration"
              value={durationMin}
              onChange={e => setDurationMin(Number(e.target.value))}
              className="min-h-[44px] rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="notes" className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
            <input
              id="notes"
              type="text"
              value={scheduleNotes}
              onChange={e => setScheduleNotes(e.target.value)}
              maxLength={500}
              placeholder="e.g. Let's talk about the family intro…"
              className="min-h-[44px] rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]"
            />
          </div>

          {scheduleError && (
            <p role="alert" className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">
              {scheduleError}
            </p>
          )}

          <button
            type="submit"
            disabled={scheduling}
            className="min-h-[44px] w-full rounded-lg bg-[#0E7C7B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a6564] disabled:opacity-60 transition-colors"
          >
            {scheduling ? 'Scheduling…' : 'Confirm Schedule'}
          </button>
        </form>
      )}

      {/* Meetings list */}
      <div>
        <h3 className="text-sm font-semibold text-[#0F172A] mb-2">Upcoming Meetings</h3>

        {loadingMeetings && (
          <p className="text-sm text-muted-foreground py-2">Loading meetings…</p>
        )}

        {meetingsError && !loadingMeetings && (
          <p role="alert" className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">
            {meetingsError}
          </p>
        )}

        {!loadingMeetings && !meetingsError && meetings.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">No meetings scheduled yet.</p>
        )}

        {!loadingMeetings && meetings.length > 0 && (
          <ul className="space-y-2">
            {meetings.map(meeting => {
              // FIX 5: Compare meeting.proposedBy (profileId) against currentProfileId
              // (also a profileId), NOT against currentUserId (Better Auth id).
              // Both are profileIds — this was the namespace mismatch bug.
              const isProposer = currentProfileId !== null && meeting.proposedBy === currentProfileId;
              const canRespond = !isProposer && meeting.status === 'PROPOSED';
              const isResponding = responding === meeting.id;

              return (
                <li
                  key={meeting.id}
                  className="rounded-xl border border-border bg-surface p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">
                        {formatDateTime(meeting.scheduledAt)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {meeting.durationMin} min
                        {meeting.notes ? ` · ${meeting.notes}` : ''}
                      </p>
                    </div>
                    {statusBadge(meeting.status)}
                  </div>

                  {canRespond && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRespond(meeting.id, 'CONFIRMED')}
                        disabled={isResponding}
                        className="min-h-[44px] flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
                      >
                        {isResponding ? '…' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => handleRespond(meeting.id, 'CANCELLED')}
                        disabled={isResponding}
                        className="min-h-[44px] flex-1 rounded-lg border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60 transition-colors"
                      >
                        {isResponding ? '…' : 'Decline'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
