/**
 * E-invite template registry (contract Item 16).
 *
 * Templates are pure presentation: each maps to a set of Smart Shaadi design
 * tokens (never raw hex). The invite content is read live from the wedding —
 * a template only changes the look.
 */

export interface InviteTemplate {
  id: string;
  name: string;
  /** Tailwind token classes — see apps/web/src/app/globals.css @theme. */
  card: string;     // card surface + frame
  eyebrow: string;  // small uppercase label
  heading: string;  // couple names
  accent: string;   // date / dividers
  body: string;     // supporting text
}

export const INVITE_TEMPLATES: InviteTemplate[] = [
  {
    id: 'classic-royal',
    name: 'Classic Royal',
    card: 'bg-background border-2 border-gold',
    eyebrow: 'text-gold',
    heading: 'text-primary',
    accent: 'text-teal',
    body: 'text-foreground',
  },
  {
    id: 'peacock-teal',
    name: 'Peacock Teal',
    card: 'bg-surface border-2 border-teal',
    eyebrow: 'text-teal',
    heading: 'text-teal',
    accent: 'text-gold',
    body: 'text-foreground',
  },
  {
    id: 'minimal-gold',
    name: 'Minimal Gold',
    card: 'bg-surface border border-gold/40',
    eyebrow: 'text-gold-muted',
    heading: 'text-primary',
    accent: 'text-gold-muted',
    body: 'text-muted-foreground',
  },
];

export const DEFAULT_TEMPLATE_ID = 'classic-royal';

export function getTemplate(id: string | null | undefined): InviteTemplate {
  return INVITE_TEMPLATES.find((t) => t.id === id) ?? INVITE_TEMPLATES[0]!;
}
