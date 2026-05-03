'use client';

import { useState, useTransition } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const CEREMONY_TYPES = [
  'WEDDING', 'HALDI', 'MEHNDI', 'SANGEET', 'ENGAGEMENT', 'RECEPTION',
  'CORPORATE', 'FESTIVAL', 'COMMUNITY', 'GOVERNMENT', 'SCHOOL', 'OTHER',
] as const;

interface InquiryDialogProps {
  vendorId: string;
  vendorName: string;
  className?: string;
}

export function InquiryDialog({ vendorId, vendorName, className }: InquiryDialogProps) {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ceremonyType, setCt] = useState<string>('WEDDING');
  const [eventDate, setDate] = useState('');
  const [guestCount, setGuests] = useState('');
  const [budgetMin, setBmin] = useState('');
  const [budgetMax, setBmax] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setSuccess(false);
    setError(null);
    setCt('WEDDING');
    setDate('');
    setGuests('');
    setBmin('');
    setBmax('');
    setMessage('');
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (message.trim().length < 5) {
      setError('Message must be at least 5 characters.');
      return;
    }

    const payload: Record<string, unknown> = { message: message.trim() };
    if (ceremonyType) payload['ceremonyType'] = ceremonyType;
    if (eventDate) payload['eventDate'] = eventDate;
    if (guestCount) payload['guestCount'] = parseInt(guestCount, 10);
    if (budgetMin) payload['budgetMin'] = parseFloat(budgetMin);
    if (budgetMax) payload['budgetMax'] = parseFloat(budgetMax);

    startTransition(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/vendors/${vendorId}/inquiries`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as { success: boolean; error?: { message?: string } };
        if (!res.ok || !json.success) {
          setError(json.error?.message ?? 'Failed to send inquiry');
          return;
        }
        setSuccess(true);
      } catch {
        setError('Network error');
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          <MessageSquare aria-hidden="true" />
          Ask a question
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ask {vendorName}</DialogTitle>
          {!success ? (
            <DialogDescription>
              Tell the vendor what you&apos;re planning. They&apos;ll reply via your inquiries inbox.
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {success ? (
          <div className="space-y-3 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal/10 text-2xl text-teal">
              ✓
            </div>
            <p className="text-sm font-medium text-primary">Inquiry sent!</p>
            <p className="text-xs text-muted-foreground">
              {vendorName} will reply via your inquiries inbox.
            </p>
            <Button variant="primary" onClick={() => setOpen(false)} type="button">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="i-type">Ceremony</Label>
                <Select value={ceremonyType} onValueChange={setCt}>
                  <SelectTrigger id="i-type">
                    <SelectValue placeholder="Select ceremony" />
                  </SelectTrigger>
                  <SelectContent>
                    {CEREMONY_TYPES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-date">Event date</Label>
                <Input
                  id="i-date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-guests">Guest count</Label>
                <Input
                  id="i-guests"
                  type="number"
                  min={1}
                  value={guestCount}
                  onChange={(e) => setGuests(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-bmin">Budget (₹)</Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="i-bmin"
                    type="number"
                    placeholder="Min"
                    min={0}
                    value={budgetMin}
                    onChange={(e) => setBmin(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    min={0}
                    value={budgetMax}
                    onChange={(e) => setBmax(e.target.value)}
                    aria-label="Maximum budget"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="i-msg">
                Message <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="i-msg"
                rows={4}
                maxLength={2000}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell the vendor what you're looking for…"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-invalid={!!error}
                aria-describedby={error ? 'i-msg-err' : undefined}
              />
            </div>

            {error ? (
              <p id="i-msg-err" role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={pending}>
                {pending ? 'Sending…' : 'Send inquiry'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
