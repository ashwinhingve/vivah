'use client';

import { useState, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

type StayQuotient = 'INDEPENDENT' | 'WITH_PARENTS' | 'WITH_INLAWS' | 'FLEXIBLE';
type Gender       = 'MALE' | 'FEMALE' | 'OTHER';
type MaritalStatus = 'NEVER_MARRIED' | 'DIVORCED' | 'WIDOWED' | 'SEPARATED';

interface PersonalFields {
  fullName:      string;
  dob:           string;           // YYYY-MM-DD
  gender:        Gender | '';
  maritalStatus: MaritalStatus | '';
  city:          string;
  religion:      string;
}

interface PreferenceFields {
  stayQuotient:            StayQuotient | '';
  familyInclinationScore:  string;
  functionAttendanceScore: string;
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: { n: Step; label: string }[] = [
    { n: 1, label: 'Personal' },
    { n: 2, label: 'Preferences' },
    { n: 3, label: 'Safety' },
    { n: 4, label: 'Photos' },
  ];

  return (
    <div className="flex items-center gap-0 w-full max-w-sm mb-6">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                current === s.n
                  ? 'bg-teal text-white'
                  : current > s.n
                  ? 'bg-success text-white'
                  : 'bg-surface border-2 border-border text-muted-foreground'
              }`}
            >
              {current > s.n ? '✓' : s.n}
            </div>
            <span
              className={`text-xs mt-1 ${
                current >= s.n ? 'text-primary font-medium' : 'text-muted-foreground'
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 flex-1 mb-4 transition-colors ${
                current > s.n ? 'bg-success' : 'bg-[#CBD5E1]'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1 — Personal basics ──────────────────────────────────────────────────

function Step1({
  fields,
  onChange,
  onNext,
}: {
  fields: PersonalFields;
  onChange: (f: Partial<PersonalFields>) => void;
  onNext: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const genderOptions: { value: Gender; label: string }[] = [
    { value: 'MALE',   label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
    { value: 'OTHER',  label: 'Other' },
  ];

  const maritalOptions: { value: MaritalStatus; label: string }[] = [
    { value: 'NEVER_MARRIED', label: 'Never married' },
    { value: 'DIVORCED',      label: 'Divorced' },
    { value: 'WIDOWED',       label: 'Widowed' },
    { value: 'SEPARATED',     label: 'Separated' },
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fields.fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!fields.dob) {
      setError('Please enter your date of birth');
      return;
    }
    if (!fields.gender) {
      setError('Please select your gender');
      return;
    }
    if (!fields.maritalStatus) {
      setError('Please select your marital status');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/profiles/me/content/personal`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            fullName:      fields.fullName.trim(),
            dob:           new Date(fields.dob).toISOString(),
            gender:        fields.gender,
            maritalStatus: fields.maritalStatus,
            ...(fields.city.trim()     && { city: fields.city.trim() }),
            ...(fields.religion.trim() && { religion: fields.religion.trim() }),
          }),
        },
      );
      const json = (await res.json()) as { success: boolean; error?: { message?: string } };
      if (!json.success) {
        setError(json.error?.message ?? 'Failed to save personal details');
        setLoading(false);
        return;
      }
      onNext();
    } catch {
      setError('Network error — please try again');
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm bg-surface rounded-xl shadow-sm border border-border p-6 space-y-5"
    >
      <div>
        <h2 className="text-xl font-semibold text-primary font-heading">
          About you
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Tell us a little about yourself</p>
      </div>

      {/* Full name */}
      <div className="space-y-1">
        <label htmlFor="fullName" className="block text-sm font-medium text-foreground">Full name</label>
        <input
          id="fullName"
          type="text"
          value={fields.fullName}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ fullName: e.target.value })}
          placeholder="e.g. Priya Sharma"
          className="w-full min-h-[44px] rounded-lg border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
      </div>

      {/* Date of birth */}
      <div className="space-y-1">
        <label htmlFor="dob" className="block text-sm font-medium text-foreground">Date of birth</label>
        <input
          id="dob"
          type="date"
          value={fields.dob}
          max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ dob: e.target.value })}
          className="w-full min-h-[44px] rounded-lg border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
      </div>

      {/* Gender */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">Gender</label>
        <div className="grid grid-cols-3 gap-2">
          {genderOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ gender: opt.value })}
              className={`min-h-[44px] rounded-lg border text-sm font-medium transition-colors ${
                fields.gender === opt.value
                  ? 'border-teal bg-teal/10 text-teal'
                  : 'border-border bg-surface text-foreground hover:border-teal/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Marital status */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">Marital status</label>
        <div className="grid grid-cols-2 gap-2">
          {maritalOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ maritalStatus: opt.value })}
              className={`min-h-[44px] rounded-lg border text-sm font-medium transition-colors ${
                fields.maritalStatus === opt.value
                  ? 'border-teal bg-teal/10 text-teal'
                  : 'border-border bg-surface text-foreground hover:border-teal/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* City (optional) */}
      <div className="space-y-1">
        <label htmlFor="city" className="block text-sm font-medium text-foreground">
          City <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          id="city"
          type="text"
          value={fields.city}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ city: e.target.value })}
          placeholder="e.g. Mumbai"
          className="w-full min-h-[44px] rounded-lg border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
      </div>

      {/* Religion (optional) */}
      <div className="space-y-1">
        <label htmlFor="religion" className="block text-sm font-medium text-foreground">
          Religion <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          id="religion"
          type="text"
          value={fields.religion}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ religion: e.target.value })}
          placeholder="e.g. Hindu"
          className="w-full min-h-[44px] rounded-lg border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-[44px] rounded-lg bg-teal hover:bg-teal-hover disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-surface/30 border-t-white animate-spin" />
            Saving…
          </>
        ) : (
          'Continue'
        )}
      </button>
    </form>
  );
}

// ── Step 2 — Living preferences ───────────────────────────────────────────────

function Step2({
  fields,
  onChange,
  onNext,
}: {
  fields: PreferenceFields;
  onChange: (f: Partial<PreferenceFields>) => void;
  onNext: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const familyScore   = parseInt(fields.familyInclinationScore,  10);
    const functionScore = parseInt(fields.functionAttendanceScore, 10);

    if (fields.stayQuotient === '') {
      setError('Please select a living arrangement preference');
      return;
    }
    if (isNaN(familyScore) || familyScore < 0 || familyScore > 100) {
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
        setError(json.error?.message ?? 'Failed to save preferences');
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
      className="w-full max-w-sm bg-surface rounded-xl shadow-sm border border-border p-6 space-y-5"
    >
      <div>
        <h2 className="text-xl font-semibold text-primary font-heading">
          Your preferences
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Help us find your best match</p>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">Living arrangement</label>
        <div className="grid grid-cols-2 gap-2">
          {stayOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ stayQuotient: opt.value })}
              className={`min-h-[44px] rounded-lg border text-sm font-medium transition-colors ${
                fields.stayQuotient === opt.value
                  ? 'border-teal bg-teal/10 text-teal'
                  : 'border-border bg-surface text-foreground hover:border-teal/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="familyScore" className="block text-sm font-medium text-foreground">
          Family inclination
          <span className="ml-2 text-xs text-muted-foreground">({fields.familyInclinationScore || '—'}/100)</span>
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
          className="w-full accent-teal"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Independent</span>
          <span>Family-oriented</span>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="functionScore" className="block text-sm font-medium text-foreground">
          Function attendance
          <span className="ml-2 text-xs text-muted-foreground">({fields.functionAttendanceScore || '—'}/100)</span>
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
          className="w-full accent-teal"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Rarely attend</span>
          <span>Always attend</span>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-[44px] rounded-lg bg-teal hover:bg-teal-hover disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-surface/30 border-t-white animate-spin" />
            Saving…
          </>
        ) : (
          'Continue'
        )}
      </button>
    </form>
  );
}

// ── Step 3 — Safety Mode info ─────────────────────────────────────────────────

function Step3({ onNext }: { onNext: () => void }) {
  return (
    <div className="w-full max-w-sm bg-surface rounded-xl shadow-sm border border-border p-6 space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-primary font-heading">
          Safety Mode
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Your privacy, your control</p>
      </div>

      <div className="rounded-lg bg-teal/8 border border-teal/20 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-teal text-lg mt-0.5">&#128274;</span>
          <div>
            <p className="text-sm font-medium text-primary">Contact details protected</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your phone number and email are hidden from other users by default. Only share contact
              details when you choose to unlock them for a specific match.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-success text-lg mt-0.5">&#9989;</span>
          <div>
            <p className="text-sm font-medium text-primary">Safety Mode is always active</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Contact unlock controls will be available once your profile is verified by our KYC team.
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="w-full min-h-[44px] rounded-lg bg-teal hover:bg-teal-hover text-white text-sm font-semibold transition-colors"
      >
        Understood, continue
      </button>
    </div>
  );
}

// ── Step 4 — Photo upload (bug-fixed) ─────────────────────────────────────────

function Step4({ onDone }: { onDone: () => void }) {
  const [file,       setFile]       = useState<File | null>(null);
  const [preview,    setPreview]    = useState<string | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

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
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

      // 1 — Get pre-signed URL
      const presignRes = await fetch(`${apiBase}/api/v1/storage/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileName: file.name, contentType: file.type, folder: 'profiles' }),
      });
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

      // 3 — Register the photo in the database (bug fix)
      const registerRes = await fetch(`${apiBase}/api/v1/profiles/me/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ r2Key: presignJson.data.r2Key, isPrimary: true, displayOrder: 0 }),
      });
      const registerJson = (await registerRes.json()) as { success: boolean; error?: { message?: string } };
      if (!registerJson.success) {
        setError(registerJson.error?.message ?? 'Photo uploaded but failed to register');
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
    <div className="w-full max-w-sm bg-surface rounded-xl shadow-sm border border-border p-6 space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-primary font-heading">
          Profile photo
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Add a clear photo to improve match quality</p>
      </div>

      <label
        htmlFor="photo-upload"
        className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-colors min-h-[160px] ${
          preview
            ? 'border-teal bg-teal/5'
            : 'border-border bg-background hover:border-teal/40'
        }`}
      >
        {preview ? (
          // blob: URLs from FileReader aren't compatible with next/image — <img> is intentional here
          <img src={preview} alt="Photo preview" className="w-full h-40 object-cover rounded-xl" />
        ) : (
          <div className="flex flex-col items-center gap-2 py-6">
            <span className="text-3xl">&#128247;</span>
            <p className="text-sm text-muted-foreground text-center">
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

      {error && <p className="text-xs text-destructive">{error}</p>}

      {uploadDone ? (
        <div className="rounded-lg bg-success/10 border border-success/20 p-3 text-center">
          <p className="text-sm font-medium text-success">Photo uploaded successfully!</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full min-h-[44px] rounded-lg bg-teal hover:bg-teal-hover disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-surface/30 border-t-white animate-spin" />
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
            ? 'border-teal bg-teal text-white font-semibold hover:bg-teal-hover'
            : 'border-border text-muted-foreground hover:border-teal/40'
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

  const [personal, setPersonal] = useState<PersonalFields>({
    fullName:      '',
    dob:           '',
    gender:        '',
    maritalStatus: '',
    city:          '',
    religion:      '',
  });

  const [preferences, setPreferences] = useState<PreferenceFields>({
    stayQuotient:            '',
    familyInclinationScore:  '50',
    functionAttendanceScore: '50',
  });

  function updatePersonal(partial: Partial<PersonalFields>) {
    setPersonal((prev) => ({ ...prev, ...partial }));
  }

  function updatePreferences(partial: Partial<PreferenceFields>) {
    setPreferences((prev) => ({ ...prev, ...partial }));
  }

  return (
    <div className="flex flex-col items-center w-full">
      <StepIndicator current={step} />

      {step === 1 && (
        <Step1 fields={personal} onChange={updatePersonal} onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <Step2 fields={preferences} onChange={updatePreferences} onNext={() => setStep(3)} />
      )}
      {step === 3 && (
        <Step3 onNext={() => setStep(4)} />
      )}
      {step === 4 && (
        <Step4 onDone={() => router.push('/')} />
      )}
    </div>
  );
}
