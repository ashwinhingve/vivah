import Image from 'next/image';
import { User, Sparkles, Users } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import {
  HOW_STEP_PROFILE,
  HOW_STEP_MATCHES,
  HOW_STEP_FAMILY,
  type Photo,
} from '@/lib/marketing-images';

type Step = {
  number: string;
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconBg: string;
  iconColor: string;
  tags: string[];
  photo: Photo;
};

const steps: Step[] = [
  {
    number: '01',
    title: 'Create Your Profile',
    description:
      'Set up in 2 minutes. Add horoscope details, family background, lifestyle preferences and photos. Family members can co-create.',
    icon: User,
    iconBg: 'bg-primary',
    iconColor: 'text-white',
    tags: ['Aadhaar Verified', 'Family Mode', 'Kundli Upload'],
    photo: HOW_STEP_PROFILE,
  },
  {
    number: '02',
    title: 'AI Finds Your Matches',
    description:
      'Our AI analyses 50+ compatibility factors including Guna Milan scores, lifestyle alignment, and family values to surface your most compatible matches daily.',
    icon: Sparkles,
    iconBg: 'bg-teal',
    iconColor: 'text-white',
    tags: ['Guna Milan Score', '36-Point Match', 'Daily Suggestions'],
    photo: HOW_STEP_MATCHES,
  },
  {
    number: '03',
    title: 'Your Families Connect',
    description:
      "Once both sides show interest, contact details unlock. Chat, video call, and let families interact — all within Smart Shaadi's safe, private ecosystem.",
    icon: Users,
    iconBg: 'bg-primary',
    iconColor: 'text-white',
    tags: ['Safe Chat', 'Video Calls', 'Family Chat Mode'],
    photo: HOW_STEP_FAMILY,
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-surface py-24 md:py-28">
      <div className="max-w-screen-xl mx-auto px-4 md:px-6">
        <p
          aria-hidden="true"
          className="text-xs font-semibold uppercase tracking-widest text-primary/70 text-center mb-3"
        >
          How it Works
        </p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-center text-foreground mb-4 font-[family-name:var(--font-heading)]">
          From Profile to Partnership in{' '}
          <span className="italic text-primary">Three Simple Steps</span>
        </h2>
        <p className="text-center text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Designed for both individuals and families. Start together, find
          together.
        </p>

        <div className="mt-20 space-y-24 md:space-y-32">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const reversed = idx % 2 === 1;
            return (
              <div
                key={step.number}
                className={`relative grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center ${
                  reversed ? 'md:[&>*:first-child]:order-2' : ''
                }`}
              >
                {/* Photo column */}
                <div className="relative">
                  <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border-2 border-gold/30">
                    <Image
                      src={step.photo.src}
                      alt={step.photo.alt}
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      quality={80}
                      className="object-cover object-center"
                    />
                  </div>
                  {/* Decorative gold corner ornament */}
                  <span
                    aria-hidden="true"
                    className="absolute -top-3 -right-3 w-16 h-16 rounded-full bg-gold/15 ring-1 ring-gold/30 backdrop-blur-sm"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-primary/8 ring-1 ring-primary/15"
                  />
                </div>

                {/* Text column */}
                <div className="relative">
                  {/* Faded huge step number background */}
                  <span
                    aria-hidden="true"
                    className="absolute -top-16 -left-4 text-[180px] md:text-[220px] leading-none font-bold text-primary/[0.04] font-[family-name:var(--font-heading)] pointer-events-none select-none"
                  >
                    {step.number}
                  </span>

                  <div className="relative">
                    <p className="text-xs font-bold text-gold tracking-widest mb-3 uppercase">
                      Step {step.number}
                    </p>
                    <div className="flex items-center gap-4 mb-4">
                      <div
                        className={`w-14 h-14 rounded-2xl ${step.iconBg} flex items-center justify-center shadow-lg flex-shrink-0`}
                      >
                        <Icon
                          width={28}
                          height={28}
                          className={step.iconColor}
                          aria-hidden="true"
                        />
                      </div>
                      <h3 className="text-2xl md:text-3xl lg:text-4xl font-medium text-primary font-[family-name:var(--font-heading)]">
                        {step.title}
                      </h3>
                    </div>

                    <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-6">
                      {step.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-background border border-border rounded-full px-3 py-1.5 text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
