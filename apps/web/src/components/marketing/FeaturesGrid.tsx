import Image from 'next/image';
import {
  Star,
  Shield,
  Calendar,
  Users,
  MessageCircle,
  ShoppingBag,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import {
  FEATURE_GUNA_MILAN,
  FEATURE_SAFETY,
  FEATURE_PLANNING,
  FEATURE_FAMILY_MODE,
  FEATURE_AI_COACH,
  FEATURE_VENDOR,
  type Photo,
} from '@/lib/marketing-images';

type Feature = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  badge: string;
  badgeClass: string;
  photo: Photo;
};

const features: Feature[] = [
  {
    icon: Star,
    iconBg: 'bg-teal',
    iconColor: 'text-white',
    title: 'AI Guna Milan Calculator',
    description:
      'Full 8-factor Ashtakoot analysis with Mangal Dosha detection. Real Vedic calculations, not guesswork.',
    badge: 'Most Used Feature',
    badgeClass: 'bg-gold/15 text-gold-muted',
    photo: FEATURE_GUNA_MILAN,
  },
  {
    icon: Shield,
    iconBg: 'bg-primary',
    iconColor: 'text-white',
    title: 'Safety Mode & Privacy',
    description:
      'Photos and contact details stay hidden until mutual interest. Aadhaar-verified profiles only. One-tap block and report.',
    badge: 'Parent Approved',
    badgeClass: 'bg-success/10 text-success',
    photo: FEATURE_SAFETY,
  },
  {
    icon: Calendar,
    iconBg: 'bg-teal',
    iconColor: 'text-white',
    title: 'Wedding Planning Suite',
    description:
      'Budget tracker, vendor booking, guest list, and RSVP management. From proposal to mandap, in one platform.',
    badge: 'Coming in Phase 2',
    badgeClass: 'bg-muted-foreground/10 text-muted-foreground',
    photo: FEATURE_PLANNING,
  },
  {
    icon: Users,
    iconBg: 'bg-primary',
    iconColor: 'text-white',
    title: 'Family Compatibility Mode',
    description:
      'Parents co-browse profiles and send family interest requests. Designed for how Indian families actually work.',
    badge: 'Unique to Smart Shaadi',
    badgeClass: 'bg-primary/10 text-primary',
    photo: FEATURE_FAMILY_MODE,
  },
  {
    icon: MessageCircle,
    iconBg: 'bg-teal',
    iconColor: 'text-white',
    title: 'AI Conversation Coach',
    description:
      'AI suggests personalised ice-breakers based on shared interests. Hindi + English support built in.',
    badge: 'AI Powered',
    badgeClass: 'bg-teal/10 text-teal',
    photo: FEATURE_AI_COACH,
  },
  {
    icon: ShoppingBag,
    iconBg: 'bg-primary',
    iconColor: 'text-white',
    title: 'Vendor Marketplace',
    description:
      'Book verified photographers, caterers, and decorators. Escrow payments protect you. One platform, complete journey.',
    badge: 'Coming in Phase 2',
    badgeClass: 'bg-muted-foreground/10 text-muted-foreground',
    photo: FEATURE_VENDOR,
  },
];

export default function FeaturesGrid() {
  return (
    <section id="features" className="bg-background py-24 md:py-28">
      <div className="max-w-screen-xl mx-auto px-4 md:px-6">
        <p
          aria-hidden="true"
          className="text-xs font-semibold uppercase tracking-widest text-primary/70 text-center mb-3"
        >
          Everything You Need
        </p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-center text-foreground mb-4 font-[family-name:var(--font-heading)]">
          Everything Your Family Needs{' '}
          <span className="italic text-primary">in One Platform</span>
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto text-center leading-relaxed">
          Built for Indian families. Not a dating app. Never will be.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="group relative overflow-hidden rounded-2xl bg-surface border border-border shadow-sm hover:shadow-xl hover:border-gold/40 transition-all duration-300 hover:-translate-y-1"
              >
                {/* Photo header */}
                <div className="relative h-40 overflow-hidden">
                  <Image
                    src={feature.photo.src}
                    alt={feature.photo.alt}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    quality={75}
                    className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"
                  />
                </div>

                {/* Card body */}
                <div className="p-6 pt-8 relative">
                  {/* Icon overlapping image edge */}
                  <div
                    className={`absolute -top-7 left-6 w-14 h-14 rounded-2xl ${feature.iconBg} flex items-center justify-center shadow-lg ring-4 ring-white`}
                  >
                    <Icon
                      width={26}
                      height={26}
                      className={feature.iconColor}
                      aria-hidden="true"
                    />
                  </div>

                  <h3 className="text-lg md:text-xl font-medium text-foreground font-[family-name:var(--font-heading)] mt-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                    {feature.description}
                  </p>
                  <span
                    className={`inline-block mt-4 text-xs font-semibold rounded-full px-3 py-1 ${feature.badgeClass}`}
                  >
                    {feature.badge}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
