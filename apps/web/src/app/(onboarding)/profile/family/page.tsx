'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { updateFamily } from '../actions';

const STEPS = [
  { label: 'Personal', done: true, active: false },
  { label: 'Family', done: false, active: true },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-[#0E7C7B] hover:bg-[#149998] text-white rounded-lg px-6 py-3 min-h-[44px] w-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? 'Saving…' : 'Save & Continue'}
    </button>
  );
}

export default function FamilyPage() {
  const [state, formAction] = useActionState(updateFamily, undefined);

  return (
    <div>
      <ProfileProgress steps={STEPS} />
      <div className="bg-white rounded-xl shadow-sm border border-[#C5A47E]/20 p-6">
        <h1
          className="text-lg font-semibold text-[#7B2D42] mb-6"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          Family Background
        </h1>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div role="alert" className="rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/20 px-4 py-3 text-sm text-[#DC2626]">
              {state.error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-1">Father's Name</label>
              <input
                name="fatherName"
                className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                placeholder="Father's full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-1">Father's Occupation</label>
              <input
                name="fatherOccupation"
                className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                placeholder="e.g. Retired Government Officer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-1">Mother's Name</label>
              <input
                name="motherName"
                className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                placeholder="Mother's full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-1">Mother's Occupation</label>
              <input
                name="motherOccupation"
                className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                placeholder="e.g. Homemaker"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-1">Native Place</label>
            <input
              name="nativePlace"
              className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
              placeholder="e.g. Pune, Maharashtra"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-2">Family Type</label>
            <div className="flex gap-3 flex-wrap">
              {(['JOINT', 'NUCLEAR', 'EXTENDED'] as const).map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="familyType" value={type} className="accent-[#0E7C7B]" />
                  <span className="text-sm text-[#2E2E38]">{type.charAt(0) + type.slice(1).toLowerCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-2">Family Values</label>
            <div className="flex gap-3 flex-wrap">
              {(['TRADITIONAL', 'MODERATE', 'LIBERAL'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="familyValues" value={v} className="accent-[#0E7C7B]" />
                  <span className="text-sm text-[#2E2E38]">{v.charAt(0) + v.slice(1).toLowerCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-2">Family Status</label>
            <div className="flex gap-3 flex-wrap">
              {[
                ['MIDDLE_CLASS', 'Middle Class'],
                ['UPPER_MIDDLE', 'Upper Middle Class'],
                ['AFFLUENT', 'Affluent'],
              ].map(([v, label]) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="familyStatus" value={v} className="accent-[#0E7C7B]" />
                  <span className="text-sm text-[#2E2E38]">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-1">About Your Family</label>
            <textarea
              name="familyAbout"
              rows={3}
              className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none resize-none"
              placeholder="Share a bit about your family background…"
            />
          </div>

          <div className="pt-2 space-y-3">
            <SubmitButton />
            <a href="/dashboard" className="block text-center text-sm text-[#6B6B76] hover:text-[#2E2E38]">
              Skip for now
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
