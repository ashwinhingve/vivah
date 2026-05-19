'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

/**
 * Slider — dual-handle (or single) range input styled to Smart Shaadi tokens.
 *
 * Track background: gold/30 opacity. Active range fill: teal.
 * Thumbs: 20px visual, gold border → teal on hover. py-4 on Root gives room
 * for the shadow without clipping.
 *
 * Usage (age range):
 *   <Slider min={18} max={60} step={1} value={[21, 50]} onValueChange={fn} />
 */
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, value, defaultValue, ...props }, ref) => {
  const thumbCount = (value ?? defaultValue ?? [0]).length;

  return (
    <SliderPrimitive.Root
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      className={cn(
        'relative flex w-full touch-none select-none items-center py-4',
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-gold/30">
        <SliderPrimitive.Range className="absolute h-full bg-teal" />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }).map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className={cn(
            'block h-5 w-5 rounded-full border-2 border-gold bg-surface shadow-card',
            'ring-offset-background transition-all duration-100 ease-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50',
            'hover:scale-110 hover:border-teal',
            'active:scale-95 active:border-teal',
          )}
          aria-label={
            thumbCount > 1
              ? (i === 0 ? 'Minimum age' : 'Maximum age')
              : 'Value'
          }
        />
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
