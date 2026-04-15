'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updatePreferences } from '../actions';

const MARITAL_STATUS_OPTIONS = [
  { value: 'NEVER_MARRIED', label: 'Never Married' },
  { value: 'DIVORCED', label: 'Divorced' },
  { value: 'WIDOWED', label: 'Widowed' },
  { value: 'SEPARATED', label: 'Separated' },
] as const;

const RELIGION_OPTIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist', 'Any'];
const DIET_OPTIONS = ['VEG', 'NON_VEG', 'JAIN', 'VEGAN', 'EGGETARIAN'];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 bg-[#0E7C7B] hover:bg-[#149998] text-white rounded-lg px-6 py-3 min-h-[44px] font-medium transition-colors disabled:opacity-50"
    >
      {pending ? 'Saving...' : 'Save Preferences'}
    </button>
  );
}

export default function PreferencesPage() {
  const [ageMin, setAgeMin] = useState(22);
  const [ageMax, setAgeMax] = useState(35);
  const [heightMin, setHeightMin] = useState(150);
  const [heightMax, setHeightMax] = useState(185);
  const [selectedMarital, setSelectedMarital] = useState<string[]>([]);
  const [selectedReligion, setSelectedReligion] = useState<string[]>([]);
  const [selectedDiet, setSelectedDiet] = useState<string[]>([]);
  const [manglik, setManglik] = useState<'ANY' | 'ONLY_MANGLIK' | 'NON_MANGLIK'>('ANY');
  const [openToInterfaith, setOpenToInterfaith] = useState(false);
  const [openToInterCaste, setOpenToInterCaste] = useState(false);
  const [partnerDescription, setPartnerDescription] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  function toggleChip(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[#7B2D42] mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
        Partner Preferences
      </h1>
      <p className="text-[#6B6B76] text-sm mb-6">What are you looking for in a partner?</p>

      <form action={updatePreferences} className="space-y-6">
        {/* Hidden inputs carry the stateful slider/chip values */}
        <input type="hidden" name="ageMin" value={ageMin} />
        <input type="hidden" name="ageMax" value={ageMax} />
        <input type="hidden" name="heightMin" value={heightMin} />
        <input type="hidden" name="heightMax" value={heightMax} />
        {selectedMarital.map(v => (
          <input key={v} type="hidden" name="maritalStatus" value={v} />
        ))}
        {selectedDiet.map(v => (
          <input key={v} type="hidden" name="diet" value={v} />
        ))}

        {/* Age Range */}
        <div className="bg-white rounded-xl shadow-sm border border-[#C5A47E]/20 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[#7B2D42]" style={{ fontFamily: 'Playfair Display, serif' }}>
            Basic Preferences
          </h2>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-2">
              Age Range: {ageMin} – {ageMax} years
            </label>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#6B6B76] w-6">18</span>
                <input
                  type="range" min={18} max={ageMax} value={ageMin}
                  onChange={e => setAgeMin(Number(e.target.value))}
                  className="flex-1 accent-[#0E7C7B]"
                />
                <span className="text-xs text-[#6B6B76] w-4">{ageMin}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#6B6B76] w-6">{ageMin}</span>
                <input
                  type="range" min={ageMin} max={75} value={ageMax}
                  onChange={e => setAgeMax(Number(e.target.value))}
                  className="flex-1 accent-[#0E7C7B]"
                />
                <span className="text-xs text-[#6B6B76] w-4">75</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-2">
              Height Range: {heightMin}cm – {heightMax}cm
            </label>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#6B6B76] w-10">140cm</span>
                <input
                  type="range" min={140} max={heightMax} value={heightMin}
                  onChange={e => setHeightMin(Number(e.target.value))}
                  className="flex-1 accent-[#0E7C7B]"
                />
                <span className="text-xs text-[#6B6B76] w-10 text-right">{heightMin}cm</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#6B6B76] w-10">{heightMin}cm</span>
                <input
                  type="range" min={heightMin} max={210} value={heightMax}
                  onChange={e => setHeightMax(Number(e.target.value))}
                  className="flex-1 accent-[#0E7C7B]"
                />
                <span className="text-xs text-[#6B6B76] w-10 text-right">210cm</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-2">Marital Status</label>
            <div className="flex flex-wrap gap-2">
              {MARITAL_STATUS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value} type="button"
                  onClick={() => toggleChip(selectedMarital, setSelectedMarital, value)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors min-h-[36px] ${
                    selectedMarital.includes(value)
                      ? 'bg-[#0E7C7B] text-white border-[#0E7C7B]'
                      : 'bg-white text-[#2E2E38] border-[#E8E0D8] hover:border-[#0E7C7B]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E38] mb-2">Religion Preference</label>
            <div className="flex flex-wrap gap-2">
              {RELIGION_OPTIONS.map(r => (
                <button
                  key={r} type="button"
                  onClick={() => toggleChip(selectedReligion, setSelectedReligion, r)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors min-h-[36px] ${
                    selectedReligion.includes(r)
                      ? 'bg-[#0E7C7B] text-white border-[#0E7C7B]'
                      : 'bg-white text-[#2E2E38] border-[#E8E0D8] hover:border-[#0E7C7B]'
                  }`}
                >
                  {r}
                </button>
              ))}
              {/* religion uses getAll in action — pass as hidden inputs */}
              {selectedReligion.map(v => (
                <input key={v} type="hidden" name="religion" value={v} />
              ))}
            </div>
          </div>
        </div>

        {/* Advanced Filters (accordion) */}
        <div className="bg-white rounded-xl shadow-sm border border-[#C5A47E]/20 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between p-6 text-left"
          >
            <h2 className="text-lg font-semibold text-[#7B2D42]" style={{ fontFamily: 'Playfair Display, serif' }}>
              Advanced Filters
            </h2>
            <span className="text-[#6B6B76] text-sm">{showAdvanced ? '▲ Hide' : '▼ Show'}</span>
          </button>

          {showAdvanced && (
            <div className="px-6 pb-6 space-y-4 border-t border-[#F0EBE4]">
              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-2">Manglik Preference</label>
                <div className="flex gap-4">
                  {(['ANY','ONLY_MANGLIK','NON_MANGLIK'] as const).map(m => (
                    <label key={m} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio" name="manglik" value={m}
                        checked={manglik === m}
                        onChange={() => setManglik(m)}
                        className="text-[#0E7C7B] focus:ring-[#0E7C7B]"
                      />
                      <span className="text-sm text-[#2E2E38]">
                        {m === 'ANY' ? 'Any' : m === 'ONLY_MANGLIK' ? 'Only Manglik' : 'Non-Manglik'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#2E2E38] mb-2">Diet Preference</label>
                <div className="flex flex-wrap gap-2">
                  {DIET_OPTIONS.map(d => (
                    <button key={d} type="button"
                      onClick={() => toggleChip(selectedDiet, setSelectedDiet, d)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors min-h-[36px] ${
                        selectedDiet.includes(d)
                          ? 'bg-[#0E7C7B] text-white border-[#0E7C7B]'
                          : 'bg-white text-[#2E2E38] border-[#E8E0D8] hover:border-[#0E7C7B]'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox" name="openToInterfaith"
                    checked={openToInterfaith}
                    onChange={e => setOpenToInterfaith(e.target.checked)}
                    className="w-5 h-5 rounded text-[#0E7C7B] focus:ring-[#0E7C7B]"
                  />
                  <span className="text-sm text-[#2E2E38]">Open to Interfaith Marriage</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox" name="openToInterCaste"
                    checked={openToInterCaste}
                    onChange={e => setOpenToInterCaste(e.target.checked)}
                    className="w-5 h-5 rounded text-[#0E7C7B] focus:ring-[#0E7C7B]"
                  />
                  <span className="text-sm text-[#2E2E38]">Open to Inter-Caste Marriage</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Partner Description */}
        <div className="bg-white rounded-xl shadow-sm border border-[#C5A47E]/20 p-6">
          <h2 className="text-lg font-semibold text-[#7B2D42] mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
            Describe Your Ideal Partner
          </h2>
          <textarea
            name="partnerDescription"
            value={partnerDescription}
            onChange={e => setPartnerDescription(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Describe qualities you're looking for in a life partner..."
            className="w-full border border-[#E8E0D8] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0E7C7B] focus:border-transparent resize-none"
          />
          <p className="text-xs text-[#6B6B76] text-right mt-1">{partnerDescription.length}/1000</p>
        </div>

        <div className="flex gap-3">
          <SubmitButton />
          <a
            href="/dashboard"
            className="px-6 py-3 text-[#6B6B76] hover:text-[#2E2E38] text-sm min-h-[44px] flex items-center"
          >
            Skip
          </a>
        </div>
      </form>
    </div>
  );
}
