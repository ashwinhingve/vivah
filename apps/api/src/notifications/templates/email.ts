/**
 * Email templates — keep them simple, transactional, brand-consistent.
 * Each template returns { subject, html, text }.
 */

interface Tpl { subject: string; html: string; text: string; }

function shell(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;background:#F8F9FC;padding:24px;color:#0F172A">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
    <h1 style="color:#0A1F4D;font-size:22px;margin:0 0 16px">${title}</h1>
    ${body}
    <p style="color:#64748B;font-size:13px;margin-top:32px">— Smart Shaadi · smartshaadi.co.in</p>
  </div>
</body></html>`;
}

export function newChatMessage(opts: { senderName: string; preview: string; matchUrl: string }): Tpl {
  return {
    subject: `${opts.senderName} sent you a message`,
    html: shell('New message', `
      <p>${opts.senderName} sent you a new message:</p>
      <blockquote style="border-left:3px solid #1848C8;padding-left:12px;color:#475569">${opts.preview}</blockquote>
      <p><a href="${opts.matchUrl}" style="background:#1848C8;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">Open chat</a></p>
    `),
    text: `${opts.senderName} sent you a message: "${opts.preview}". Open: ${opts.matchUrl}`,
  };
}

export function paymentCaptured(opts: { amount: number; bookingId: string; receiptUrl: string }): Tpl {
  return {
    subject: `Payment of ₹${opts.amount.toLocaleString('en-IN')} received`,
    html: shell('Payment received', `
      <p>We received your payment of <strong>₹${opts.amount.toLocaleString('en-IN')}</strong>.</p>
      <p>Booking ID: <code>${opts.bookingId}</code></p>
      <p><a href="${opts.receiptUrl}" style="color:#1848C8">Download receipt</a></p>
    `),
    text: `Payment of ₹${opts.amount} received. Booking ${opts.bookingId}. Receipt: ${opts.receiptUrl}`,
  };
}

export function meetingInvite(opts: { proposerName: string; scheduledAt: string; durationMin: number; joinUrl: string }): Tpl {
  return {
    subject: `${opts.proposerName} invited you to a video call`,
    html: shell('Video call invite', `
      <p>${opts.proposerName} invited you to a video call.</p>
      <p><strong>When:</strong> ${opts.scheduledAt}<br/><strong>Duration:</strong> ${opts.durationMin} minutes</p>
      <p><a href="${opts.joinUrl}" style="background:#1848C8;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">Join call</a></p>
    `),
    text: `${opts.proposerName} invited you to a video call at ${opts.scheduledAt} (${opts.durationMin}min). Join: ${opts.joinUrl}`,
  };
}

export function genericNotification(opts: { title: string; body: string; ctaUrl?: string; ctaLabel?: string }): Tpl {
  const cta = opts.ctaUrl
    ? `<p><a href="${opts.ctaUrl}" style="background:#1848C8;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">${opts.ctaLabel ?? 'Open'}</a></p>`
    : '';
  return {
    subject: opts.title,
    html: shell(opts.title, `<p>${opts.body}</p>${cta}`),
    text: `${opts.title}\n\n${opts.body}${opts.ctaUrl ? `\n\n${opts.ctaUrl}` : ''}`,
  };
}
