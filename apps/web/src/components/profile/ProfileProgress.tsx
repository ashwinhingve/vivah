interface Step {
  label: string;
  done: boolean;
  active: boolean;
}

interface ProfileProgressProps {
  steps: Step[];
}

export function ProfileProgress({ steps }: ProfileProgressProps) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center flex-1">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                step.done
                  ? 'bg-[#0E7C7B] text-white'
                  : step.active
                    ? 'bg-[#7B2D42] text-white'
                    : 'bg-gray-200 text-gray-500'
              }`}
            >
              {step.done ? '✓' : i + 1}
            </div>
            <span className="text-xs mt-1 text-center text-gray-500 hidden sm:block">{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1 ${step.done ? 'bg-[#0E7C7B]' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
