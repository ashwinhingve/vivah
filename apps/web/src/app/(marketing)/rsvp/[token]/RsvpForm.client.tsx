'use client';

import { useState, useTransition } from 'react';
import { Loader2, Check, AlertTriangle } from 'lucide-react';
import type { PublicRsvpView, MealPref, GuestCeremonyPref } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Props {
  token:  string;
  view:   PublicRsvpView;
}

const MEAL_OPTS: MealPref[] = ['VEG', 'NON_VEG', 'JAIN', 'VEGAN', 'EGGETARIAN', 'NO_PREFERENCE'];
const MEAL_LABEL: Record<MealPref, string> = {
  VEG: 'Vegetarian', NON_VEG: 'Non-Vegetarian', JAIN: 'Jain', VEGAN: 'Vegan',
  EGGETARIAN: 'Eggetarian', NO_PREFERENCE: 'No preference',
};

export function RsvpForm({ token, view }: Props) {
  const initialStatus: 'YES' | 'NO' | 'MAYBE' =
    view.guest.rsvpStatus === 'PENDING' ? 'YES' : (view.guest.rsvpStatus as 'YES' | 'NO' | 'MAYBE');

  const [status, setStatus]   = useState<'YES' | 'NO' | 'MAYBE'>(initialStatus);
  const [meal, setMeal]       = useState<MealPref>((view.guest.mealPref ?? 'NO_PREFERENCE'));
  const [plusOnes, setPlusOnes] = useState<number>(view.guest.plusOnes);
  const [plusOneNames, setPlusOneNames] = useState<string[]>(view.guest.plusOneNames);
  const [dietary, setDietary] = useState<string>(view.guest.dietaryNotes ?? '');
  const [accessibility, setAccessibility] = useState<string>(view.guest.accessibilityNotes ?? '');
  const [message, setMessage] = useState('');

  // Per-ceremony attendance
  const initialPrefs: Record<string, GuestCeremonyPref> = Object.fromEntries(
    view.ceremonyPrefs.map(p => [p.ceremonyId, p]),
  );
  const [ceremonyPrefs, setCeremonyPrefs] = useState<Record<string, { attending: boolean; mealPref: MealPref }>>(
    Object.fromEntries(view.ceremonies.map(c => [
      c.id,
      { attending: initialPrefs[c.id]?.attending ?? true, mealPref: initialPrefs[c.id]?.mealPref ?? 'NO_PREFERENCE' },
    ])),
  );

  // Custom answers
  const initialAnswers: Record<string, { text?: string; bool?: boolean }> = Object.fromEntries(
    view.customAnswers.map(a => [a.questionId, { text: a.answerText ?? undefined, bool: a.answerBool ?? undefined }]),
  );
  const [answers, setAnswers] = useState<Record<string, { text?: string; bool?: boolean }>>(initialAnswers);

  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Deadline banner
  const deadline = view.deadline?.deadline ? new Date(view.deadline.deadline) : null;
  const hoursUntilDeadline = deadline ? (deadline.getTime() - Date.now()) / (60 * 60 * 1000) : null;
  const deadlineWarning = hoursUntilDeadline != null && hoursUntilDeadline < 48 && hoursUntilDeadline > 0;
  const deadlineClosed  = view.deadline?.enforced && hoursUntilDeadline != null && hoursUntilDeadline <= 0;

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);

    // Validate required custom questions
    for (const q of view.customQuestions) {
      if (!q.isRequired) continue;
      const a = answers[q.id];
      if (!a) { setError(`Please answer: ${q.questionText}`); return; }
      if (q.questionType === 'TEXT' && !a.text?.trim()) { setError(`Please answer: ${q.questionText}`); return; }
      if (q.questionType === 'BOOLEAN' && a.bool === undefined) { setError(`Please answer: ${q.questionText}`); return; }
      if (q.questionType === 'CHOICE' && !a.text) { setError(`Please pick an option: ${q.questionText}`); return; }
    }

    startTransition(async () => {
      try {
        const cpArr = Object.entries(ceremonyPrefs).map(([ceremonyId, p]) => ({
          ceremonyId, attending: p.attending, mealPref: p.mealPref,
        }));
        const customArr = Object.entries(answers).map(([questionId, a]) => ({
          questionId,
          ...(a.text !== undefined ? { answerText: a.text } : {}),
          ...(a.bool !== undefined ? { answerBool: a.bool } : {}),
        }));

        const res = await fetch(`${API_URL}/api/v1/rsvp/${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rsvpStatus: status,
            mealPref:   meal,
            plusOnes,
            plusOneNames,
            dietaryNotes: dietary || undefined,
            accessibilityNotes: accessibility || undefined,
            message: message || undefined,
            ceremonyPrefs: cpArr.length > 0 ? cpArr : undefined,
            customAnswers: customArr.length > 0 ? customArr : undefined,
          }),
        });
        const json = await res.json() as { success: boolean; error?: { message?: string } };
        if (!json.success) {
          setError(json.error?.message ?? 'Could not submit RSVP. Please try again.');
          return;
        }
        setSubmitted(true);
      } catch {
        setError('Network error. Please try again.');
      }
    });
  }

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-3">
          <Check className="h-6 w-6 text-green-700" />
        </div>
        <p className="font-semibold text-[#7B2D42]">RSVP submitted</p>
        <p className="text-sm text-muted-foreground mt-1">Thank you! See you soon.</p>
      </div>
    );
  }

  if (deadlineClosed) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-destructive/15 mb-3">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <p className="font-semibold text-destructive">RSVP closed</p>
        <p className="text-sm text-muted-foreground mt-1">The RSVP deadline has passed. Please reach out to the couple directly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {deadlineWarning && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          RSVP deadline: {deadline?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at {deadline?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2">Will you attend?</label>
        <div className="flex gap-2">
          {(['YES', 'NO', 'MAYBE'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`flex-1 min-h-[44px] rounded-lg border text-sm font-medium ${status === s ? 'bg-[#7B2D42] text-white border-[#7B2D42]' : 'bg-surface text-foreground border-[#C5A47E]/30'}`}
            >
              {s === 'YES' ? "Yes, I'll be there" : s === 'NO' ? "Sorry, can't make it" : 'Maybe'}
            </button>
          ))}
        </div>
      </div>

      {status !== 'NO' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Meal preference</label>
              <select value={meal} onChange={e => setMeal(e.target.value as MealPref)}
                className="w-full min-h-[40px] rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm">
                {MEAL_OPTS.map(m => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Bringing guests?</label>
              <input type="number" min={0} max={8} value={plusOnes}
                onChange={e => {
                  const n = Math.max(0, Math.min(8, Number(e.target.value) || 0));
                  setPlusOnes(n);
                  setPlusOneNames(prev => prev.slice(0, n));
                }}
                className="w-full min-h-[40px] rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm" />
            </div>
          </div>

          {plusOnes > 0 && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Plus-one names</label>
              <div className="space-y-1.5">
                {Array.from({ length: plusOnes }).map((_, i) => (
                  <input key={i}
                    value={plusOneNames[i] ?? ''}
                    onChange={(e) => setPlusOneNames(prev => prev.map((v, j) => j === i ? e.target.value : v).concat(Array(Math.max(0, i + 1 - prev.length)).fill('')).slice(0, plusOnes))}
                    placeholder={`Plus-one ${i + 1}`}
                    className="w-full min-h-[40px] rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm"
                  />
                ))}
              </div>
            </div>
          )}

          {view.ceremonies.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Which ceremonies will you attend?</label>
              <div className="space-y-2">
                {view.ceremonies.map(c => (
                  <div key={c.id} className="flex items-center gap-2">
                    <label className="flex items-center gap-2 flex-1 text-sm">
                      <input
                        type="checkbox"
                        checked={ceremonyPrefs[c.id]?.attending ?? true}
                        onChange={(e) => setCeremonyPrefs(prev => ({ ...prev, [c.id]: { attending: e.target.checked, mealPref: prev[c.id]?.mealPref ?? 'NO_PREFERENCE' } }))}
                        className="h-4 w-4"
                      />
                      <span>{c.type}{c.date ? ` · ${new Date(c.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Dietary restrictions / allergies</label>
            <input value={dietary} onChange={e => setDietary(e.target.value)}
              placeholder="e.g. nut allergy, gluten-free"
              className="w-full min-h-[40px] rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Accessibility needs</label>
            <input value={accessibility} onChange={e => setAccessibility(e.target.value)}
              placeholder="e.g. wheelchair access"
              className="w-full min-h-[40px] rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm" />
          </div>

          {view.customQuestions.length > 0 && (
            <div className="space-y-3 border-t border-[#C5A47E]/20 pt-4 mt-4">
              <p className="text-xs font-medium text-muted-foreground">A few more questions from the couple</p>
              {view.customQuestions.map(q => (
                <div key={q.id}>
                  <label className="block text-xs font-medium mb-1">
                    {q.questionText}{q.isRequired && <span className="text-destructive ml-0.5">*</span>}
                  </label>
                  {q.questionType === 'TEXT' && (
                    <input
                      value={answers[q.id]?.text ?? ''}
                      onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], text: e.target.value } }))}
                      className="w-full min-h-[40px] rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm"
                    />
                  )}
                  {q.questionType === 'BOOLEAN' && (
                    <div className="flex gap-2">
                      {[true, false].map(v => (
                        <button
                          type="button"
                          key={String(v)}
                          onClick={() => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], bool: v } }))}
                          className={`flex-1 min-h-[40px] rounded-lg border text-sm font-medium ${answers[q.id]?.bool === v ? 'bg-[#7B2D42] text-white border-[#7B2D42]' : 'border-[#C5A47E]/30 text-muted-foreground'}`}
                        >
                          {v ? 'Yes' : 'No'}
                        </button>
                      ))}
                    </div>
                  )}
                  {q.questionType === 'CHOICE' && q.choices && (
                    <select
                      value={answers[q.id]?.text ?? ''}
                      onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], text: e.target.value } }))}
                      className="w-full min-h-[40px] rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm"
                    >
                      <option value="">Select…</option>
                      {q.choices.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Message to the couple</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
          className="w-full rounded-lg border border-[#C5A47E]/30 px-3 py-2 text-sm" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button type="submit" disabled={isPending}
        className="w-full min-h-[48px] rounded-lg bg-[#7B2D42] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Send RSVP
      </button>
    </form>
  );
}
