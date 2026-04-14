import Link from 'next/link';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { TRUST_INDIVIDUALS, TRUST_FAMILIES } from '@/lib/marketing-images';

const individualPoints = [
  'Aadhaar-verified profiles — no fake accounts',
  'Safety Mode — photos hidden until you choose',
  "Silent decline — they'll never know you passed",
  '24/7 human support team',
];

const familyPoints = [
  'Family-created profiles welcomed and respected',
  'Parent Mode — separate family dashboard',
  'Family Verified badge — 4-tier verification system',
  'Respects community and cultural preferences',
];

export default function TrustSection() {
  return (
    <section id="for-families" className="grid grid-cols-1 lg:grid-cols-2">
      {/* LEFT — For Individuals (burgundy-overlaid bride photo) */}
      <div className="relative isolate min-h-[600px] lg:min-h-[680px] flex items-center">
        <Image
          src={TRUST_INDIVIDUALS.src}
          alt={TRUST_INDIVIDUALS.alt}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          quality={80}
          className="object-cover object-center -z-20"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-br from-[#7B2D42]/95 via-[#7B2D42]/88 to-[#5C2032]/85"
        />

        <div className="relative w-full max-w-[640px] ml-auto px-8 md:px-12 py-20 md:py-24">
          <p
            aria-hidden="true"
            className="text-xs uppercase tracking-widest text-[#C5A47E] mb-3 font-semibold border-l-2 border-[#C5A47E] pl-3"
          >
            For Individuals
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white font-[family-name:var(--font-heading)] leading-tight [text-shadow:_0_2px_16px_rgba(0,0,0,0.3)]">
            Your Privacy.
            <br />
            Your Timeline.
            <br />
            <span className="italic text-[#F4D9C2]">Your Choice.</span>
          </h2>
          <p className="text-white/85 mt-6 leading-relaxed text-base [text-shadow:_0_1px_8px_rgba(0,0,0,0.3)]">
            You control everything. Photos stay blurred until you choose to
            reveal them. Contact details unlock only after mutual interest.
            Block anyone with one tap.
          </p>

          <ul className="mt-8 space-y-4">
            {individualPoints.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-[#C5A47E]/30 ring-1 ring-[#C5A47E]/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check
                    className="w-4 h-4 text-[#F4D9C2]"
                    aria-hidden="true"
                  />
                </span>
                <span className="text-white/95 text-sm md:text-base [text-shadow:_0_1px_6px_rgba(0,0,0,0.3)]">
                  {point}
                </span>
              </li>
            ))}
          </ul>

          <Link
            href="/register"
            className="inline-flex items-center justify-center bg-white text-[#7B2D42] font-semibold rounded-lg px-7 py-3.5 mt-10 min-h-[48px] hover:bg-white/95 transition-all duration-200 shadow-xl shadow-black/20 hover:-translate-y-0.5"
          >
            Create Free Profile →
          </Link>
        </div>
      </div>

      {/* RIGHT — For Families (ivory-washed family photo) */}
      <div className="relative isolate min-h-[600px] lg:min-h-[680px] flex items-center">
        <Image
          src={TRUST_FAMILIES.src}
          alt={TRUST_FAMILIES.alt}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          quality={80}
          className="object-cover object-center -z-20"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-bl from-[#FEFAF6]/96 via-[#FEFAF6]/92 to-[#FFFFFF]/88"
        />

        <div className="relative w-full max-w-[640px] mr-auto px-8 md:px-12 py-20 md:py-24">
          <p
            aria-hidden="true"
            className="text-xs uppercase tracking-widest text-[#7B2D42]/70 mb-3 font-semibold border-l-2 border-[#7B2D42]/40 pl-3"
          >
            For Families
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-[#7B2D42] font-[family-name:var(--font-heading)] leading-tight">
            A Platform Built for{' '}
            <span className="italic text-[#0E7C7B]">How Families</span>{' '}
            Actually Work.
          </h2>
          <p className="text-[#2E2E38] mt-6 leading-relaxed text-base">
            Indian matrimony has always been a family decision. Smart Shaadi is
            built for that reality. Parents co-browse profiles. Both families
            verify each other. Trust is built before any meeting.
          </p>

          <ul className="mt-8 space-y-4">
            {familyPoints.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-[#0E7C7B]/15 ring-1 ring-[#0E7C7B]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check
                    className="w-4 h-4 text-[#0E7C7B]"
                    aria-hidden="true"
                  />
                </span>
                <span className="text-[#2E2E38] text-sm md:text-base">
                  {point}
                </span>
              </li>
            ))}
          </ul>

          <Link
            href="/register?mode=family"
            className="inline-flex items-center justify-center bg-[#0E7C7B] hover:bg-[#149998] text-white font-semibold rounded-lg px-7 py-3.5 mt-10 min-h-[48px] transition-all duration-200 shadow-lg shadow-[#0E7C7B]/30 hover:shadow-xl hover:shadow-[#0E7C7B]/40 hover:-translate-y-0.5"
          >
            Explore Family Mode →
          </Link>
        </div>
      </div>
    </section>
  );
}
