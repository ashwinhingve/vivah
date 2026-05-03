import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Users, Sparkles } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { FamilyMembersClient } from '@/components/family/FamilyMembersClient.client';
import { RequestFamilyVerification } from '@/components/family/RequestFamilyVerification.client';
import type { FamilyView, FamilyVerificationBadge } from '@smartshaadi/types';

const BADGE_LABEL: Record<FamilyVerificationBadge, string> = {
  NONE:            'Not verified',
  FAMILY_VERIFIED: 'Family verified',
  PARENT_VERIFIED: 'Parent verified',
};

export default async function FamilyPage() {
  const view = await fetchAuth<FamilyView>('/api/v1/profiles/me/family');
  if (!view) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FEFAF6' }}>
        <p className="text-sm text-muted-foreground">Could not load family information.</p>
      </div>
    );
  }

  const { section, members, verification, inclinationScore } = view;
  const score = inclinationScore ?? 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FEFAF6' }}>
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#7B2D42] mb-6 min-h-[44px]">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>

        <h1 className="font-heading text-2xl text-[#7B2D42] mb-1">Family</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Add structured family details that power matchmaking and trust badges. Free-form intro lives on your profile.
        </p>

        {/* Top stat row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <Card icon={<Users className="h-4 w-4 text-[#7B2D42]" />} title="Family members">
            <div className="text-2xl font-semibold">{members.length}</div>
          </Card>
          <Card icon={<Sparkles className="h-4 w-4 text-[#0E7C7B]" />} title="Family signal score">
            <div className="text-2xl font-semibold">{score}<span className="text-base text-muted-foreground"> / 100</span></div>
            <div className="h-1.5 bg-secondary rounded mt-2 overflow-hidden">
              <div className="h-full bg-[#0E7C7B]" style={{ width: `${score}%` }} />
            </div>
          </Card>
          <Card icon={<ShieldCheck className="h-4 w-4 text-amber-600" />} title="Verification">
            <div className="text-base font-semibold">{verification ? BADGE_LABEL[verification.badge] : 'Not verified'}</div>
            {verification?.verifiedAt && (
              <p className="text-[10px] text-muted-foreground">Verified {new Date(verification.verifiedAt).toLocaleDateString()}</p>
            )}
            <RequestFamilyVerification verified={verification?.isVerified ?? false} />
          </Card>
        </div>

        {/* Family bio summary */}
        <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-4 mb-6">
          <h3 className="font-medium text-sm text-[#7B2D42] mb-3">Family details</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Field label="Father">{section.fatherName ?? '—'}{section.fatherOccupation ? ` · ${section.fatherOccupation}` : ''}</Field>
            <Field label="Mother">{section.motherName ?? '—'}{section.motherOccupation ? ` · ${section.motherOccupation}` : ''}</Field>
            <Field label="Family type">{section.familyType ?? '—'}</Field>
            <Field label="Family values">{section.familyValues ?? '—'}</Field>
            <Field label="Native place">{section.nativePlace ?? '—'}</Field>
            <Field label="Family status">{section.familyStatus ?? '—'}</Field>
          </dl>
          {section.siblings && section.siblings.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#C5A47E]/10">
              <p className="text-xs text-muted-foreground mb-1">Siblings</p>
              <ul className="text-sm space-y-1">
                {section.siblings.map((s, i) => (
                  <li key={i}>
                    {s.name ?? 'Unnamed'}
                    {s.occupation ? ` · ${s.occupation}` : ''}
                    {s.married ? ' · married' : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {section.familyAbout && (
            <div className="mt-3 pt-3 border-t border-[#C5A47E]/10">
              <p className="text-xs text-muted-foreground mb-1">About</p>
              <p className="text-sm whitespace-pre-line">{section.familyAbout}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Edit details from <Link href="/profile/family" className="text-[#0E7C7B] underline">profile family page</Link>.
          </p>
        </div>

        {/* Family members CRUD */}
        <FamilyMembersClient initial={members} />
      </div>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-4">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-xs text-muted-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
