'use client';

import { useState, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

type StayQuotient = 'INDEPENDENT' | 'WITH_PARENTS' | 'WITH_INLAWS' | 'FLEXIBLE';

interface ProfileFields {
  stayQuotient:            StayQuotient | '';
  familyInclinationScore:  string; // kept as string for input binding
  functionAttendanceScore: string;
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1 as Step, label: 'Details' },
    { n: 2 as Step, label: 'Safety' },
    { n: 3 as Step, label: 'Photos' },
  ];

  return (
    <div className="flex items-center gap-0 w-full max-w-sm mb-6">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                current === s.n
                  ? 'bg-[#0E7C7B] text-white'
                  : current > s.n
                  ? 'bg-[#059669] text-white'
                  : 'bg-white border-2 border-[#CBD5E1] text-[#64748B]'
              }`}
            >
              {current > s.n ? '✓' : s.n}
            </div>
            <span
              className={`text-xs mt-1 ${
                current >= s.n ? 'text-[#0A1F4D] font-medium' : 'text-[#64748B]'
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 flex-1 mb-4 transition-colors ${
                current > s.n ? 'bg-[#059669]' : 'bg-[#CBD5E1]'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1 — Profile details ──────────────────────────────────────────────────

function Step1({
  fields,
  onChange,
  onNext,
}: {
  fields: ProfileFields;
  onChange: (f: Partial<ProfileFields>) => void;
  onNext: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const familyScore  = parseInt(fields.familyInclinationScore,  10);
    const functionScore = parseInt(fields.functionAttendanceScore, 10);

    if (fields.stayQuotient === '') {
      setError('Please select a living arrangement preference');
      return;
    }
    if (isNaN(familyScore)  || familyScore  < 0 || familyScore  > 100) {
      setError('Family inclination score must be between 0 and 100');
      return;
    }
    if (isNaN(functionScore) || functionScore < 0 || functionScore > 100) {
      setError('Function attendance score must be between 0 and 100');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/profiles/me`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            stayQuotient:            fields.stayQuotient,
            familyInclinationScore:  familyScore,
            functionAttendanceScore: functionScore,
          }),
        },
      );
      const json = (await res.json()) as { success: boolean; error?: { message?: string } };
      if (!json.success) {
        setError(json.error?.message ?? 'Failed to save profile');
        setLoading(false);
        return;
      }
      onNext();
    } catch {
      setError('Network error — please try again');
      setLoading(false);
    }
  }

  const stayOptions: { value: StayQuotient; label: string }[] = [
    { value: 'INDEPENDENT',   label: 'Independent' },
    { value: 'WITH_PARENTS',  label: 'With parents' },
    { value: 'WITH_INLAWS',   label: 'With in-laws' },
    { value: 'FLEXIBLE',      label: 'Flexible' },
  ];

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 space-y-5"
    >
      <div>
        <h2 className="text-xl font-semibold text-[#0A1F4D]" style={{ fontFamily: 'Playfair Display, serif' }}>
          Your preferences
        </h2>
        <p className="text-sm text-[#64748B] mt-1">Help us find your best match</p>
      </div>

      {/* Stay preference */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-[#0F172A]">Living arrangement</label>
        <div className="grid grid-cols-2 gap-2">
          {stayOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ stayQuotient: opt.value })}
              className={`min-h-[44px] rounded-lg border text-sm font-medium transition-colors ${
                fields.stayQuotient === opt.value
                  ? 'border-[#0E7C7B] bg-[#0E7C7B]/10 text-[#0E7C7B]'
                  : 'border-[#E2E8F0] bg-white text-[#0F172A] hover:border-[#0E7C7B]/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Family inclination */}
      <div className="space-y-1">
        <label htmlFor="familyScore" className="block text-sm font-medium text-[#0F172A]">
          Family inclination
          <span className="ml-2 text-xs text-[#64748B]">({fields.familyInclinationScore || '—'}/100)</span>
        </label>
        <input
          id="familyScore"
          type="range"
          min={0}
          max={100}
          step={5}
          value={fields.familyInclinationScore || '50'}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange({ familyInclinationScore: e.target.value })
          }
          className="w-full accent-[#0E7C7B]"
        />
        <div className="flex justify-between text-xs text-[#64748B]">
          <span>Independent</span>
          <span>Family-oriented</span>
        </div>
      </div>

      {/* Function attendance */}
      <div className="space-y-1">
        <label htmlFor="functionScore" className="block text-sm font-medium text-[#0F172A]">
          Function attendance
          <span className="ml-2 text-xs text-[#64748B]">({fields.functionAttendanceScore || '—'}/100)</span>
        </label>
        <input
          id="functionScore"
          type="range"
          min={0}
          max={100}
          step={5}
          value={fields.functionAttendanceScore || '50'}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange({ functionAttendanceScore: e.target.value })
          }
          className="w-full accent-[#0E7C7B]"
        />
        <div className="flex justify-between text-xs text-[#64748B]">
          <span>Rarely attend</span>
          <span>Always attend</span>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-[44px] rounded-lg bg-[#0E7C7B] hover:bg-[#149998] disabled:opacity-60 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Saving…
          </>
        ) : (
          'Continue'
        )}
      </button>
    </form>
  );
}

// ── Step 2 — Safety Mode info ─────────────────────────────────────────────────

function Step2({ onNext }: { onNext: () => void }) {
  return (
    <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-[#0A1F4D]" style={{ fontFamily: 'Playfair Display, serif' }}>
          Safety Mode
        </h2>
        <p className="text-sm text-[#64748B] mt-1">Your privacy, your control</p>
      </div>

      <div className="rounded-lg bg-[#0E7C7B]/8 border border-[#0E7C7B]/20 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-[#0E7C7B] text-lg mt-0.5">&#128274;</span>
          <div>
            <p className="text-sm font-medium text-[#0A1F4D]">Contact details protected</p>
            <p className="text-xs text-[#64748B] mt-0.5">
              Your phone number and email are hidden from other users by default. Only share contact
              details when you choose to unlock them for a specific match.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-[#059669] text-lg mt-0.5">&#9989;</span>
          <div>
            <p className="text-sm font-medium text-[#0A1F4D]">Safety Mode is always active</p>
            <p className="text-xs text-[#64748B] mt-0.5">
              Contact unlock controls will be available once your profile is verified by our KYC team.
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="w-full min-h-[44px] rounded-lg bg-[#0E7C7B] hover:bg-[#149998] text-white text-sm font-medium transition-colors"
      >
        Understood, continue
      </button>
    </div>
  );
}

// ── Step 3 — Photo upload ─────────────────────────────────────────────────────

function Step3({ onDone }: { onDone: () => void }) {
  const [file,          setFile]          = useState<File | null>(null);
  const [preview,       setPreview]       = useState<string | null>(null);
  const [uploading,     setUploading]     = useState(false);
  const [uploadDone,    setUploadDone]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setError(null);
  }

  async function handleUpload() {
    if (!file) { setError('Please select a photo first'); return; }
    setError(null);
    setUploading(true);

    try {
      // 1 — Get pre-signed URL from API
      const presignRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/storage/presign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            fileName:    file.name,
            contentType: file.type,
            folder:      'profiles',
          }),
        },
      );
      const presignJson = (await presignRes.json()) as {
        success: boolean;
        data?: { uploadUrl: string; r2Key: string };
        error?: { message?: string };
      };

      if (!presignJson.success || !presignJson.data) {
        setError(presignJson.error?.message ?? 'Failed to get upload URL');
        setUploading(false);
        return;
      }

      // 2 — Upload directly to R2
      const r2Res = await fetch(presignJson.data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!r2Res.ok) {
        setError('Upload failed — please try again');
        setUploading(false);
        return;
      }

      setUploadDone(true);
    } catch {
      setError('Network error — please try again');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-[#0A1F4D]" style={{ fontFamily: 'Playfair Display, serif' }}>
          Profile photo
        </h2>
        <p className="text-sm text-[#64748B] mt-1">Add a clear photo to improve match quality</p>
      </div>

      {/* File picker */}
      <label
        htmlFor="photo-upload"
        className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-colors min-h-[160px] ${
          preview
            ? 'border-[#0E7C7B] bg-[#0E7C7B]/5'
            : 'border-[#CBD5E1] bg-[#F8F9FC] hover:border-[#0E7C7B]/40'
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Preview"
            className="w-full h-40 object-cover rounded-xl"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 py-6">
            <span className="text-3xl">&#128247;</span>
            <p className="text-sm text-[#64748B] text-center">
              Tap to select a photo
              <br />
              <span className="text-xs">JPEG · PNG · WebP</span>
            </p>
          </div>
        )}
        <input
          id="photo-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleFileChange}
        />
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {uploadDone ? (
        <div className="rounded-lg bg-[#059669]/10 border border-[#059669]/20 p-3 text-center">
          <p className="text-sm font-medium text-[#059669]">Photo uploaded successfully!</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full min-h-[44px] rounded-lg bg-[#0E7C7B] hover:bg-[#149998] disabled:opacity-60 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Uploading…
            </>
          ) : (
            'Upload photo'
          )}
        </button>
      )}

      <button
        type="button"
        onClick={onDone}
        className={`w-full min-h-[44px] rounded-lg border text-sm font-medium transition-colors ${
          uploadDone
            ? 'border-[#0E7C7B] bg-[#0E7C7B] text-white hover:bg-[#149998]'
            : 'border-[#E2E8F0] text-[#64748B] hover:border-[#0E7C7B]/40'
        }`}
      >
        {uploadDone ? 'View my profile' : 'Skip for now'}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CreateProfilePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [fields, setFields] = useState<ProfileFields>({
    stayQuotient:            '',
    familyInclinationScore:  '50',
    functionAttendanceScore: '50',
  });

  function updateFields(partial: Partial<ProfileFields>) {
    setFields((prev) => ({ ...prev, ...partial }));
  }

  function handleDone() {
    router.push('/');
  }

  return (
    <div className="flex flex-col items-center w-full">
      <StepIndicator current={step} />

      {step === 1 && (
        <Step1 fields={fields} onChange={updateFields} onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <Step2 onNext={() => setStep(3)} />
      )}
      {step === 3 && (
        <Step3 onDone={handleDone} />
      )}
    </div>
  );
}
