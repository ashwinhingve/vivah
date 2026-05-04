import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Minimum tap target for any interactive element on mobile (Smart Shaadi
 * design system: 44×44px). Compose with other classes via `cn()`.
 *   <button className={cn(touchTarget, 'rounded-lg bg-primary')}>...</button>
 */
export const touchTarget = 'min-h-[44px] min-w-[44px]';
