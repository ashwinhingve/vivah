/*
 * PLACEHOLDER TESTIMONIALS — Design/demo only.
 * Replace with real verified user testimonials before any investor demo or
 * public launch. Fabricated testimonials on a trust platform are self-defeating.
 *
 * Avatar policy: NO stock photos. Initials in gold-bordered circles only.
 */
import { getTranslations } from 'next-intl/server';
import AnimatedSection from './AnimatedSection.client';
import { Heart } from 'lucide-react';

interface Testimonial {
  quote: string;
  name: string;
  initials: string;
  initialsColors: { bg: string; text: string };
  detail: string;
  date: string;
  extraBadge?: string;
  engaged?: boolean;
}

const testimonials: Testimonial[] = [
  {
    quote:
      'The Guna Milan calculator showed 34/36 — my mother was convinced before I even met her. Smart Shaadi understood what our family needed. The transparency of the score breakdown made all the difference.',
    name: 'Rahul Sharma',
    initials: 'RS',
    initialsColors: { bg: 'bg-primary/15', text: 'text-primary' },
    detail: 'Mumbai · Software Engineer, 28',
    date: 'March 2026',
  },
  {
    quote:
      "As a parent, I was sceptical of apps. Smart Shaadi's Family Mode let me browse alongside my daughter without any awkwardness. The profiles felt genuine. We found the right match in just 3 weeks.",
    name: 'Mrs. Kavita Patel',
    initials: 'KP',
    initialsColors: { bg: 'bg-teal/10', text: 'text-teal' },
    detail: 'Ahmedabad · Parent, 52',
    date: 'February 2026',
    extraBadge: 'Profile by Parent ✓',
  },
  {
    quote:
      'Matched and engaged within three months. The AI matched us on Gunas AND shared hobbies. The compatibility breakdown helped both families understand the match immediately — no awkward explanations needed.',
    name: 'Ananya & Vikram',
    initials: 'AV',
    initialsColors: { bg: 'bg-gold/15', text: 'text-gold-muted' },
    detail: 'Bangalore · Engaged via Smart Shaadi',
    date: 'April 2026',
    engaged: true,
  },
];

export default async function Testimonials() {
  const t = await getTranslations('marketing.testimonials');

  return (
    <section
      id="testimonials"
      className="relative isolate bg-surface py-24 md:py-28 overflow-hidden"
    >
      {/* Decorative mandala ring — background ornament */}
      <svg
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[640px] opacity-[0.04] pointer-events-none -z-0"
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g fill="none" stroke="var(--color-primary)" strokeWidth="0.5">
          {[80, 65, 50, 35, 20].map((r) => (
            <circle key={r} cx="100" cy="100" r={r} />
          ))}
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i * Math.PI * 2) / 16;
            return (
              <line
                key={i}
                x1="100"
                y1="100"
                x2={100 + Math.cos(angle) * 80}
                y2={100 + Math.sin(angle) * 80}
              />
            );
          })}
        </g>
      </svg>

      <div className="relative max-w-screen-xl mx-auto px-4 md:px-6">
        {/* Section header */}
        <AnimatedSection className="text-center mb-14">
          <p
            aria-hidden="true"
            className="text-xs font-semibold uppercase tracking-widest text-gold-muted mb-3"
          >
            Early Access Feedback
          </p>
          <h2
            className="font-[family-name:var(--font-heading)] font-semibold text-foreground"
            style={{ fontSize: 'clamp(1.75rem, 3.5vw, 3rem)' }}
          >
            {t('sectionHeading')}
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed max-w-md mx-auto">
            What our early access members are saying
          </p>
        </AnimatedSection>

        {/* Cards — horizontal scroll on mobile, 3-col grid on desktop */}
        <div
          className="flex gap-5 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 snap-x snap-mandatory"
          role="list"
        >
          {testimonials.map((t, idx) => (
            <AnimatedSection
              key={t.name}
              delay={idx * 0.1}
              className="flex-shrink-0 w-[80vw] sm:w-[60vw] md:w-auto snap-start"
              as="article"
            >
              <figure
                className="relative bg-background rounded-2xl p-6 md:p-7 border border-border shadow-card hover:shadow-card-hover transition-all duration-300 h-full flex flex-col"
                role="listitem"
              >
                {/* Decorative open-quote */}
                <span
                  aria-hidden="true"
                  className="absolute top-3 right-5 text-7xl leading-none text-gold/20 pointer-events-none select-none font-[family-name:var(--font-heading)]"
                >
                  &ldquo;
                </span>

                {/* Star rating */}
                <p aria-hidden="true" className="text-gold text-sm mb-3 tracking-wider">
                  ★★★★★
                </p>
                <span className="sr-only">Rated 5 out of 5 stars.</span>

                {/* Quote */}
                <blockquote className="border-l-2 border-gold/40 pl-4 text-foreground text-sm md:text-base leading-relaxed italic flex-1">
                  {t.quote}
                </blockquote>

                {/* Attribution */}
                <figcaption className="flex items-center gap-3 mt-6">
                  {/* Initials circle — no photos */}
                  <div
                    className={[
                      'w-12 h-12 rounded-full ring-2 ring-gold/30 flex items-center justify-center flex-shrink-0 font-semibold text-sm',
                      t.initialsColors.bg,
                      t.initialsColors.text,
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    {t.initials}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                      {t.name}
                      {t.engaged && (
                        <Heart
                          className="w-3.5 h-3.5 text-primary flex-shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{t.detail}</p>
                    <p className="text-xs text-foreground/40 mt-0.5">{t.date}</p>
                    {t.extraBadge && (
                      <span className="inline-block mt-1 text-xs bg-primary/10 text-primary rounded-full px-2.5 py-0.5 leading-5">
                        {t.extraBadge}
                      </span>
                    )}
                  </div>
                </figcaption>
              </figure>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
