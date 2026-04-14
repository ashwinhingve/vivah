'use client';

import { useFormStatus } from 'react-dom';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { updateCareer } from '../actions';

const STEPS = [
  { label: 'Family', done: true, active: false },
  { label: 'Career', done: false, active: true },
  { label: 'Lifestyle', done: false, active: false },
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

export default function CareerPage() {
  return (
    <div>
      <ProfileProgress steps={STEPS} />
      <div className="bg-white rounded-xl shadow-sm border border-[#C5A47E]/20 p-6">
        <h1 className="text-lg font-semibold text-[#7B2D42] font-playfair mb-6">Education & Career</h1>
        <form action={updateCareer} className="space-y-4">
          <fieldset>
            <legend className="text-sm font-semibold text-gray-600 mb-3">Education</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Highest Degree</label>
                <select
                  name="degree"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none bg-white"
                >
                  <option value="">Select degree</option>
                  {[
                    'High School',
                    'Diploma',
                    'B.A.',
                    'B.Sc.',
                    'B.Com.',
                    'B.Tech.',
                    'B.E.',
                    'M.A.',
                    'M.Sc.',
                    'M.Com.',
                    'M.Tech.',
                    'MBA',
                    'MCA',
                    'MBBS',
                    'MD',
                    'Ph.D.',
                    'Other',
                  ].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field of Study</label>
                <input
                  name="fieldOfStudy"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                  placeholder="e.g. Computer Science"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">College / University</label>
                <input
                  name="college"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                  placeholder="Institution name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Graduation Year</label>
                <input
                  name="year"
                  type="number"
                  min={1950}
                  max={2030}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                  placeholder="e.g. 2020"
                />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold text-gray-600 mb-3">Profession</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
                <input
                  name="occupation"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                  placeholder="e.g. Software Engineer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employer Type</label>
                <select
                  name="employerType"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none bg-white"
                >
                  <option value="">Select type</option>
                  {[
                    ['PRIVATE', 'Private Sector'],
                    ['GOVERNMENT', 'Government / PSU'],
                    ['BUSINESS', 'Own Business'],
                    ['SELF_EMPLOYED', 'Self Employed'],
                    ['NOT_WORKING', 'Not Working'],
                  ].map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employer / Company</label>
                <input
                  name="employer"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                  placeholder="Company name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <input
                  name="designation"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                  placeholder="e.g. Senior Developer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Annual Income</label>
                <select
                  name="incomeRange"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none bg-white"
                >
                  <option value="">Select range</option>
                  {['< 3 LPA', '3-5 LPA', '5-10 LPA', '10-15 LPA', '15-25 LPA', '25-50 LPA', '50+ LPA'].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work Location</label>
                <input
                  name="workLocation"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent outline-none"
                  placeholder="e.g. Pune"
                />
              </div>
            </div>
          </fieldset>

          <div className="pt-2 space-y-3">
            <SubmitButton />
            <a href="/dashboard" className="block text-center text-sm text-gray-500 hover:text-gray-700">
              Skip for now
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
