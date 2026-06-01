import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Smart Shaadi',
  description:
    'The terms governing your use of the Smart Shaadi matchmaking and wedding-services platform.',
};

const LAST_UPDATED = '1 June 2026';

interface Section {
  heading: string;
  body: string[];
}

const SECTIONS: Section[] = [
  {
    heading: '1. Acceptance of these terms',
    body: [
      'By creating an account or using Smart Shaadi (the "Platform") you agree to these Terms of Service. If you do not agree, do not use the Platform.',
    ],
  },
  {
    heading: '2. Eligibility',
    body: [
      'You must be at least 18 years old and legally permitted to marry under applicable Indian law to use the Platform. By using it you confirm that the information you provide is true and that you are using the service for genuine matrimonial purposes.',
    ],
  },
  {
    heading: '3. Your account and authentication',
    body: [
      'Accounts are secured by phone-based OTP authentication. You are responsible for activity under your account and for keeping your device and credentials secure. Notify us immediately of any unauthorised use.',
    ],
  },
  {
    heading: '4. Acceptable use',
    body: [
      'You agree not to: misrepresent your identity, marital status, or intentions; harass, abuse, or solicit other members; post unlawful, obscene, or fraudulent content; scrape or harvest data; or use the Platform for any purpose other than genuine matchmaking and wedding planning.',
      'We may suspend or terminate accounts that violate these terms or our community standards.',
    ],
  },
  {
    heading: '5. Matchmaking — no guarantee',
    body: [
      'The Platform provides tools, compatibility scores (including Guna Milan), and AI-assisted recommendations to help you find a match. We do not guarantee a marriage, a match, or the accuracy of any member-provided information. Decisions about whom you meet or marry are entirely your own, and you should exercise your own judgement and due diligence.',
    ],
  },
  {
    heading: '6. Payments, subscriptions, and refunds',
    body: [
      'Paid plans and bookings are processed through our payment partner, Razorpay. Subscription pricing and renewal terms are shown at the point of purchase.',
      'Vendor bookings may use an escrow mechanism; funds are released or refunded according to the booking and dispute terms presented at checkout. Refund eligibility is governed by our Refund Policy.',
    ],
  },
  {
    heading: '7. Vendors and third-party services',
    body: [
      'Vendors listed on the Platform are independent third parties. We facilitate discovery and booking but are not a party to the contract between you and a vendor and are not liable for the quality or delivery of vendor services.',
    ],
  },
  {
    heading: '8. Intellectual property',
    body: [
      'The Platform, its software, branding, and content (other than your own user content) are owned by Smart Shaadi or its licensors. You retain rights to content you upload but grant us a licence to host and display it for the purpose of operating the service.',
    ],
  },
  {
    heading: '9. Limitation of liability',
    body: [
      'To the maximum extent permitted by law, Smart Shaadi is not liable for indirect, incidental, or consequential damages, or for the conduct of other members or vendors. The Platform is provided on an "as is" and "as available" basis.',
    ],
  },
  {
    heading: '10. Termination',
    body: [
      'You may close your account at any time. We may suspend or terminate access for breach of these terms, for legal reasons, or to protect members. Provisions that by their nature should survive termination will continue to apply.',
    ],
  },
  {
    heading: '11. Governing law and disputes',
    body: [
      'These terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the courts at the seat to be specified before launch.',
    ],
  },
  {
    heading: '12. Changes to these terms',
    body: [
      'We may revise these terms from time to time. Material changes will be notified through the Platform. Continued use after changes take effect constitutes acceptance.',
    ],
  },
  {
    heading: '13. Contact',
    body: ['Questions about these terms: support@smartshaadi.co.in.'],
  },
];

export default function TermsPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <header className="text-center">
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-primary">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>
        </header>

        <div
          role="note"
          className="mt-8 rounded-2xl border border-gold/40 bg-surface p-4 text-sm leading-relaxed text-gold-muted shadow-card"
        >
          <strong className="font-semibold">Starter template &mdash; not legal advice.</strong>{' '}
          This document is a placeholder. It must be reviewed and finalised by qualified legal
          counsel (and translated for Hindi readers) before public launch.
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
