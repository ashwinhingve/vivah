/**
 * SMS templates — short, transactional, ≤160 chars where possible.
 * Long messages get split into multiple SMS at the carrier.
 */

export function newChatMessage(opts: { senderName: string; preview: string }): string {
  const previewClipped = opts.preview.length > 60 ? `${opts.preview.slice(0, 60)}...` : opts.preview;
  return `${opts.senderName}: ${previewClipped} — Reply on Smart Shaadi.`;
}

export function paymentCaptured(opts: { amount: number; bookingId: string }): string {
  return `Smart Shaadi: ₹${opts.amount.toLocaleString('en-IN')} payment received for booking ${opts.bookingId.slice(0, 8)}.`;
}

export function meetingInvite(opts: { proposerName: string; scheduledAt: string }): string {
  return `Smart Shaadi: ${opts.proposerName} invited you to a video call at ${opts.scheduledAt}.`;
}

export function genericNotification(opts: { title: string; body: string }): string {
  return `${opts.title}: ${opts.body}`.slice(0, 480);
}
