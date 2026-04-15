interface Step {
  label: string;
  done: boolean;
  active: boolean;
}

interface ProfileProgressProps {
  steps: Step[];
}

const ALL_STEPS = [
  'Personal',
  'Family',
  'Career',
  'Lifestyle',
  'Horoscope',
  'Community',
  'Preferences',
  'Photos',
];

export function ProfileProgress({ steps }: ProfileProgressProps) {
  // Map provided steps onto the canonical 8-step sequence
  const normalized = ALL_STEPS.map((label) => {
    const match = steps.find((s) => s.label === label);
    return match ?? { label, done: false, active: false };
  });

  return (
    <div className="overflow-x-auto pb-2 mb-8 -mx-1 px-1">
      <div className="flex items-center gap-0 min-w-max">
        {normalized.map((step, i) => (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center w-14">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  step.done
                    ? 'bg-[#0E7C7B] text-white'
                    : step.active
                      ? 'bg-[#7B2D42] text-white ring-2 ring-[#7B2D42]/30'
                      : 'bg-[#E8E0D8] text-[#6B6B76]'
                }`}
              >
                {step.done ? (
                  <svg viewBox="0 0 12 10" className="w-3 h-3 fill-none stroke-white stroke-2 stroke-linecap-round stroke-linejoin-round">
                    <polyline points="1,5 4.5,8.5 11,1.5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-[10px] mt-1 text-center leading-tight w-full ${
                  step.active ? 'text-[#7B2D42] font-semibold' : 'text-[#6B6B76]'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < normalized.length - 1 && (
              <div
                className={`h-0.5 w-4 shrink-0 ${
                  step.done ? 'bg-[#0E7C7B]' : 'bg-[#E8E0D8]'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
