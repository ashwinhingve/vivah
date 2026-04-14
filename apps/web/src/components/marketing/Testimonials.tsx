/*
 * PLACEHOLDER TESTIMONIALS — Design/demo only.
 * Replace with real verified user testimonials AND real portraits before
 * any investor demo or public launch. The avatar photos here are stock —
 * the names are fictional. Fabricated testimonials on a trust platform
 * are self-defeating.
 */
import Image from 'next/image';
import { Heart } from 'lucide-react';
import {
  TESTIMONIAL_RAHUL,
  TESTIMONIAL_KAVITA,
  TESTIMONIAL_COUPLE,
  type Photo,
} from '@/lib/marketing-images';

type Testimonial = {
  quote: string;
  name: string;
  detail: string;
  avatar: Photo;
  extraBadge?: string;
  engaged?: boolean;
};

const testimonials: Testimonial[] = [
  {
    quote:
      'The Guna Milan calculator showed 34/36 — my mother was convinced before I even met her. Smart Shaadi understood what our family needed.',
    name: 'Rahul Sharma',
    detail: 'Mumbai · Software Engineer, 28',
    avatar: TESTIMONIAL_RAHUL,
  },
  {
    quote:
      "As a parent, I was sceptical of apps. Smart Shaadi's Family Mode let me browse alongside my daughter. The profiles felt genuine. We found the right match in 3 weeks.",
    name: 'Mrs. Kavita Patel',
    detail: 'Ahmedabad · Parent',
    avatar: TESTIMONIAL_KAVITA,
    extraBadge: 'Profile by Parent ✓',
  },
  {
    quote:
      'Matched and engaged within months. The AI matched us on Gunas AND shared hobbies. The compatibility breakdown helped both families understand the match immediately.',
    name: 'Ananya & Vikram',
    detail: 'Bangalore · Engaged via Smart Shaadi',
    avatar: TESTIMONIAL_COUPLE,
    engaged: true,
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="relative isolate bg-white py-24 md:py-28 overflow-hidden">
      {/* Decorative paisley/mandala SVG ornament */}
      <svg
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] opacity-[0.04] pointer-events-none -z-0"
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g fill="none" stroke="#7B2D42" strokeWidth="0.5">
          <circle cx="100" cy="100" r="80" />
          <circle cx="100" cy="100" r="65" />
          <circle cx="100" cy="100" r="50" />
          <circle cx="100" cy="100" r="35" />
          <circle cx="100" cy="100" r="20" />
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i * Math.PI * 2) / 16;
            const x = 100 + Math.cos(angle) * 80;
            const y = 100 + Math.sin(angle) * 80;
            return <line key={i} x1="100" y1="100" x2={x} y2={y} />;
          })}
        </g>
      </svg>

      <div className="relative max-w-screen-xl mx-auto px-4 md:px-6">
        <p
          aria-hidden="true"
          className="text-xs font-semibold uppercase tracking-widest text-[#7B2D42]/70 text-center mb-3"
        >
          Early Access Feedback
        </p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-center text-[#2E2E38] mb-4 font-[family-name:var(--font-heading)]">
          Real Families.{' '}
          <span className="italic text-[#7B2D42]">Real Matches.</span>
        </h2>
        <p className="text-[#6B6B76] text-center mb-16 leading-relaxed">
          What our early access members are saying
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="relative bg-[#FEFAF6] rounded-2xl p-6 md:p-7 border border-[#E8E0D8] shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              <span
                aria-hidden="true"
                className="absolute top-3 right-5 text-7xl leading-none text-[#C5A47E]/25 pointer-events-none select-none font-[family-name:var(--font-heading)]"
              >
                &ldquo;
              </span>
              <div className="relative">
                <p
                  aria-hidden="true"
                  className="text-[#C5A47E] text-sm mb-3 tracking-wider"
                >
                  ★★★★★
                </p>
                <span className="sr-only">Rated 5 out of 5 stars.</span>
                <blockquote className="border-l-4 border-[#C5A47E] pl-4 text-[#2E2E38] text-sm md:text-base leading-relaxed italic">
                  {t.quote}
                </blockquote>
                <figcaption className="flex items-center gap-3 mt-6">
                  <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#C5A47E] flex-shrink-0">
                    <Image
                      src={t.avatar.src}
                      alt={t.avatar.alt}
                      width={t.avatar.width}
                      height={t.avatar.height}
                      quality={80}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#2E2E38] flex items-center gap-1.5">
                      {t.name}
                      {t.engaged ? (
                        <Heart
                          className="inline w-3.5 h-3.5 text-[#7B2D42]"
                          aria-hidden="true"
                        />
                      ) : null}
                    </p>
                    <p className="text-xs text-[#6B6B76]">{t.detail}</p>
                    {t.extraBadge ? (
                      <span className="inline-block mt-1 text-xs bg-[#7B2D42]/10 text-[#7B2D42] rounded-full px-2.5 py-1">
                        {t.extraBadge}
                      </span>
                    ) : null}
                  </div>
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
