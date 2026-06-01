import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Smart Shaadi',
  description:
    'How Smart Shaadi collects, uses, and protects your personal data, aligned with India’s Digital Personal Data Protection Act, 2023 (DPDP).',
};

const LAST_UPDATED = '1 June 2026';

interface Section {
  heading: string;
  body: string[];
}

const SECTIONS: Section[] = [
  {
    heading: '1. Who we are',
    body: [
      'Smart Shaadi ("we", "us", "the Platform") is a marriage-centric matchmaking and wedding-services platform operated in India. For the purposes of the Digital Personal Data Protection Act, 2023 ("DPDP Act"), we act as the Data Fiduciary for the personal data you provide.',
      'Data Fiduciary: Smart Shaadi (legal entity name and registered address to be inserted before launch).',
    ],
  },
  {
    heading: '2. Data we collect',
    body: [
      'Account & profile data: name, date of birth, gender, phone number, email, community, location, photos, lifestyle and family details you choose to add to your profile.',
      'Verification status only: when you complete KYC we store the verification result and a reference token. We do NOT store your raw Aadhaar number, full KYC documents, or biometric data.',
      'Usage data: matches viewed, shortlists, chat metadata, device and log information used to operate and secure the service.',
      'Payment data: handled by our payment processor (Razorpay). We store transaction status and references, not full card numbers.',
    ],
  },
  {
    heading: '3. Why we use your data (purpose)',
    body: [
      'To create and operate your account, surface reciprocal matches, enable chat and contact sharing, process bookings and payments, run safety and fraud checks, and meet legal obligations.',
      'Contact details (phone, email) are masked by default and are only revealed to another member after you explicitly unlock contact sharing for that specific match.',
    ],
  },
  {
    heading: '4. Consent and how to withdraw it',
    body: [
      'We process your personal data on the basis of the consent you give when you register and when you enable specific features (e.g. KYC, contact sharing).',
      'You may withdraw consent at any time from your account settings or by contacting our Grievance Officer. Withdrawing consent may limit or end your ability to use parts of the Platform. Withdrawal does not affect processing already carried out lawfully.',
    ],
  },
  {
    heading: '5. Your rights as a Data Principal',
    body: [
      'Under the DPDP Act you have the right to: access a summary of your personal data and how it is processed; request correction or completion of inaccurate or incomplete data; request erasure of your data where it is no longer needed; nominate another individual to exercise your rights in the event of death or incapacity; and raise a grievance.',
      'To exercise any of these rights, contact our Grievance Officer (below). We will respond within the timelines required by law.',
    ],
  },
  {
    heading: '6. Grievance redressal',
    body: [
      'Grievance Officer: (name to be inserted before launch).',
      'Email: grievance@smartshaadi.co.in.',
      'If you are not satisfied with our response, you may approach the Data Protection Board of India.',
    ],
  },
  {
    heading: '7. Third-party processors',
    body: [
      'We share the minimum data necessary with trusted processors who act on our instructions: Razorpay (payments), MSG91 (OTP and SMS), DigiLocker (identity verification), Cloudflare R2 (media storage), and AWS SES (email).',
      'Each processor is bound to use your data only to provide their service to us.',
    ],
  },
  {
    heading: '8. Data retention',
    body: [
      'We keep your personal data only as long as your account is active or as needed to provide the service and meet legal, tax, and dispute-resolution obligations. When data is no longer required, we delete or anonymise it.',
    ],
  },
  {
    heading: '9. Security',
    body: [
      'We use industry-standard safeguards including encryption in transit, access controls, masked contact details, and stored verification status rather than raw identity documents. No system is perfectly secure, and we encourage you to protect your account credentials.',
    ],
  },
  {
    heading: '10. Children',
    body: [
      'The Platform is intended only for individuals aged 18 and above. We do not knowingly create profiles for minors.',
    ],
  },
  {
    heading: '11. Changes to this policy',
    body: [
      'We may update this policy from time to time. Material changes will be notified through the Platform. The "Last updated" date above reflects the latest revision.',
    ],
  },
  {
    heading: '12. Contact',
    body: ['Questions about this policy: privacy@smartshaadi.co.in.'],
  },
];

export default function PrivacyPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <header className="text-center">
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-primary">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>
        </header>

        <div
          role="note"
          className="mt-8 rounded-2xl border border-gold/40 bg-surface p-4 text-sm leading-relaxed text-gold-muted shadow-card"
        >
          <strong className="font-semibold">Starter template &mdash; not legal advice.</strong>{' '}
          This document is a placeholder drafted to align with the DPDP Act, 2023. It must be
          reviewed and finalised by qualified legal counsel (and translated for Hindi readers)
          before public launch.
        </div>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="font-heading text-xl font-semibold text-primary">
                {section.heading}
              </h2>
              <div className="mt-2 space-y-2">
                {section.body.map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                    {para}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
