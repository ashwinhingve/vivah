'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { updatePersonal } from '../actions';

const STEPS = [
  { label: 'Personal', done: false, active: true },
];

const RELIGIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist', 'Other'];

const MOTHER_TONGUES = [
  'Hindi', 'Marathi', 'Gujarati', 'Tamil', 'Telugu', 'Kannada',
  'Malayalam', 'Punjabi', 'Bengali', 'Odia', 'Assamese', 'English', 'Other',
];

const HEIGHTS_FT = [4, 5, 6, 7];
const HEIGHTS_IN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full min-h-[44px] rounded-lg bg-[#0E7C7B] hover:bg-[#149998] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
    >
      {pending ? 'Saving…' : 'Save & Continue'}
    </button>
  );
}

export default function PersonalPage() {
  const [state, formAction] = useActionState(updatePersonal, undefined);

  return (
    <div>
      <ProfileProgress steps={STEPS} />

      <div className="bg-white rounded-xl shadow-sm border border-[#C5A47E]/20 overflow-hidden">
        {/* Section header */}
        <div className="bg-gradient-to-r from-[#7B2D42]/5 to-transparent px-5 py-4 border-b border-[#C5A47E]/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#7B2D42]/10 flex items-center justify-center text-base">
            👤
          </div>
          <h1
            className="font-semibold text-[#7B2D42] text-lg"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Personal Details
          </h1>
        </div>

        <div className="p-5">
          <form action={formAction} className="space-y-4">
            {state?.error && (
              <div role="alert" className="rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/20 px-4 py-3 text-sm text-[#DC2626]">
                {state.error}
              </div>
            )}
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-1">Full Name</label>
              <input
                name="fullName"
                type="text"
                autoComplete="name"
                required
                className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                placeholder="Your full name"
              />
            </div>

            {/* DOB + Marital Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-1">Date of Birth</label>
                <input
                  name="dob"
                  type="date"
                  required
                  className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-1">Marital Status</label>
                <select
                  name="maritalStatus"
                  defaultValue=""
                  className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none bg-white"
                >
                  <option value="" disabled>Select status</option>
                  <option value="NEVER_MARRIED">Never Married</option>
                  <option value="DIVORCED">Divorced</option>
                  <option value="WIDOWED">Widowed</option>
                  <option value="SEPARATED">Separated</option>
                </select>
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-2">Gender</label>
              <div className="flex gap-3 flex-wrap">
                {(['MALE', 'FEMALE', 'OTHER'] as const).map((g) => (
                  <label key={g} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="gender" value={g} className="accent-[#0E7C7B]" required />
                    <span className="text-sm text-[#2E2E38]">
                      {g.charAt(0) + g.slice(1).toLowerCase()}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Height */}
            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-1">Height</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <select
                    name="heightFt"
                    defaultValue="5"
                    className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none bg-white"
                  >
                    {HEIGHTS_FT.map((ft) => (
                      <option key={ft} value={ft}>{ft} ft</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <select
                    name="heightIn"
                    defaultValue="6"
                    className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none bg-white"
                  >
                    {HEIGHTS_IN.map((inch) => (
                      <option key={inch} value={inch}>{inch} in</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Religion + Mother Tongue */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-1">Religion</label>
                <select
                  name="religion"
                  defaultValue=""
                  className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none bg-white"
                >
                  <option value="" disabled>Select religion</option>
                  {RELIGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-1">Mother Tongue</label>
                <select
                  name="motherTongue"
                  defaultValue=""
                  className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none bg-white"
                >
                  <option value="" disabled>Select language</option>
                  {MOTHER_TONGUES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Current City */}
            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-1">Current City</label>
              <input
                name="currentCity"
                type="text"
                className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                placeholder="e.g. Pune, Maharashtra"
              />
            </div>

            {/* About Me */}
            <div>
              <label className="block text-sm font-medium text-[#2E2E38] mb-1">About Me</label>
              <textarea
                name="aboutMe"
                rows={3}
                maxLength={500}
                className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none resize-none"
                placeholder="Share a little about yourself, your interests, and what you're looking for…"
              />
            </div>

            <div className="pt-2 space-y-3">
              <SubmitButton />
              <a
                href="/dashboard"
                className="block text-center text-sm text-[#6B6B76] hover:text-[#2E2E38] transition-colors"
              >
                Skip for now
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
