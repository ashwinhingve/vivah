/**
 * Shared component — renders an e-invite card from the public payload.
 * Used by both the builder live preview (client) and the public /i/[slug]
 * page (server). Design tokens only; Playfair via `font-heading`.
 */
import { getTemplate } from '@/lib/invites/templates';
import type { PublicInviteView } from '@/lib/invites/types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function InviteCard({ view }: { view: PublicInviteView }) {
  const t = getTemplate(view.templateId);
  const bride = (view.brideName ?? '').trim();
  const groom = (view.groomName ?? '').trim();
  const couple = bride && groom ? `${bride} & ${groom}` : (view.title ?? (bride || groom || 'Our Wedding'));
  const venueLine = [view.venueName, view.venueCity].filter(Boolean).join(', ');
  const muhurat = [view.muhuratName, view.muhuratTithi].filter(Boolean).join(' · ');

  return (
    <article
      className={`${t.card} mx-auto w-full max-w-md rounded-2xl shadow-card p-6 sm:p-8 text-center`}
    >
      <p className={`${t.eyebrow} text-xs uppercase tracking-[0.2em] mb-4`}>
        Together with their families
      </p>

      <h1 className={`${t.heading} font-heading text-3xl sm:text-4xl leading-tight`}>
        {couple}
      </h1>

      {view.message ? (
        <p className={`${t.body} mt-3 italic`}>{view.message}</p>
      ) : (
        <p className={`${t.body} mt-3 italic`}>request the pleasure of your company</p>
      )}

      <div className="my-5 flex items-center justify-center gap-3" aria-hidden>
        <span className="h-px w-10 bg-gold/60" />
        <span className="text-gold">❖</span>
        <span className="h-px w-10 bg-gold/60" />
      </div>

      {view.weddingDate && (
        <p className={`${t.accent} font-heading text-xl`}>{formatDate(view.weddingDate)}</p>
      )}
      {muhurat && <p className={`${t.body} text-sm mt-1`}>Muhurat: {muhurat}</p>}

      {venueLine && <p className={`${t.heading} font-medium mt-4`}>{venueLine}</p>}
      {view.venueAddress && <p className={`${t.body} text-sm`}>{view.venueAddress}</p>}

      {view.ceremonies.length > 0 && (
        <div className="mt-6 text-left">
          <p className={`${t.eyebrow} text-xs uppercase tracking-[0.2em] text-center mb-3`}>
            Celebrations
          </p>
          <ul className="space-y-3">
            {view.ceremonies.map((c) => {
              const when = [formatDate(c.date), c.startTime].filter(Boolean).join(' · ');
              return (
                <li key={c.id} className="text-center">
                  <p className={`${t.heading} font-heading text-lg`}>{titleCase(c.type)}</p>
                  {(when || c.venue) && (
                    <p className={`${t.body} text-sm`}>
                      {[when, c.venue].filter(Boolean).join(' — ')}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {view.hashtag && <p className={`${t.accent} mt-6 text-sm font-medium`}>{view.hashtag}</p>}
    </article>
  );
}
