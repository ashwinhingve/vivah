/**
 * Smart Shaadi — PII masking helpers
 *
 * CLAUDE.md rule 5: phone numbers and email addresses never appear in API
 * responses by default. Most of the platform satisfies this by returning
 * `null` for non-self viewers (see profiles/service.ts) — that is the right
 * shape when the viewer has no business knowing a value exists.
 *
 * These helpers cover the other case: an admin console, where the operator
 * legitimately needs to recognise and disambiguate accounts ("is this the
 * Sharma who called, or the other one?") without the page rendering a
 * harvestable contact list. Masked values preserve enough to match against a
 * detail the user reads out on a support call, and nothing more.
 *
 * Deliberately NOT reversible and NOT a security boundary on their own —
 * a masked value still identifies an account to someone who already knows the
 * real one. They reduce incidental exposure; they do not authorise access.
 */

/**
 * `ashwin.hingave123@gmail.com` -> `as***@gmail.com`
 *
 * Keeps the domain (which is rarely identifying on its own and is what an
 * operator actually scans for) and the first two characters of the local part.
 * Single-character local parts reveal nothing beyond their length.
 */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  // Not a shape we recognise — mask the whole thing rather than guess.
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const keep = local.slice(0, Math.min(2, local.length));
  return `${keep}***${domain}`;
}

/**
 * `+919876543210` -> `+91*****3210`
 *
 * Last four digits only. That is what a support operator reads back to confirm
 * identity, and it is the convention Indian users already expect from banks
 * and telcos, so it needs no explanation in the UI.
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '***';
  const last4 = digits.slice(-4);
  // Preserve a leading country code if one is present — it is not identifying
  // and it distinguishes NRI accounts at a glance, which matters here.
  const cc = phone.startsWith('+') ? `+${digits.slice(0, digits.length - 10 > 0 ? digits.length - 10 : 0)}` : '';
  return `${cc}*****${last4}`;
}
