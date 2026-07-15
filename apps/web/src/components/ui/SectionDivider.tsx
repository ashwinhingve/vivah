import { Sparkles } from 'lucide-react';

interface SectionDividerProps {
  /** Icon to show in the center. Defaults to Sparkles. */
  icon?: React.ReactNode;
  /** Optional CSS class for the divider container. */
  className?: string;
}

/**
 * Subtle section divider — a thin gold gradient line with a centered glyph.
 * Used sparingly between landing page sections for visual rhythm and breathing room.
 */
export function SectionDivider({ icon = <Sparkles className="h-4 w-4" />, className = '' }: SectionDividerProps) {
  return (
    <div className={`relative flex items-center justify-center py-8 ${className}`} aria-hidden="true">
      {/* Left gradient line */}
      <div className="absolute left-0 top-1/2 h-px w-full max-w-[calc(50%-32px)] bg-gradient-to-r from-transparent to-gold/40" />

      {/* Center glyph */}
      <div className="relative z-10 flex items-center justify-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-background">
          <div className="text-gold-muted">
            {icon}
          </div>
        </div>
      </div>

      {/* Right gradient line */}
      <div className="absolute right-0 top-1/2 h-px w-full max-w-[calc(50%-32px)] bg-gradient-to-l from-transparent to-gold/40" />
    </div>
  );
}
