'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

import { cn } from '@/lib/utils';

interface DualRangeSliderProps extends React.ComponentProps<typeof SliderPrimitive.Root> {
  labelPosition?: 'top' | 'bottom';
  label?: (value: number | undefined) => React.ReactNode;
}

const DualRangeSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  DualRangeSliderProps
>(({ className, label, labelPosition = 'top', ...props }, ref) => {
  const values = React.useMemo(
    () =>
      Array.isArray(props.value)
        ? props.value
        : [props.min, props.max].filter((value): value is number => typeof value === 'number'),
    [props.max, props.min, props.value]
  );

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn('relative flex w-full touch-none select-none items-center', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2.5 w-full grow overflow-hidden rounded-full bg-[rgb(255_244_227_/_0.1)] shadow-[inset_0_0_0_1px_rgb(255_244_227_/_0.04)]">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-[var(--color-accent)] shadow-[0_0_24px_rgb(201_184_154_/_0.28)]" />
      </SliderPrimitive.Track>
      {values.map((value, index) => (
        <React.Fragment key={index}>
          <SliderPrimitive.Thumb className="relative block h-5 w-5 rounded-full border border-[var(--color-accent)] bg-[var(--color-bg)] shadow-[0_0_0_8px_rgb(201_184_154_/_0.08)] transition-[transform,box-shadow] duration-300 focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:pointer-events-none disabled:opacity-50">
            {label ? (
              <span
                className={cn(
                  'absolute left-1/2 flex -translate-x-1/2 justify-center whitespace-nowrap text-[0.62rem] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]',
                  labelPosition === 'top' && '-top-8',
                  labelPosition === 'bottom' && 'top-6'
                )}
              >
                {label(value)}
              </span>
            ) : null}
          </SliderPrimitive.Thumb>
        </React.Fragment>
      ))}
    </SliderPrimitive.Root>
  );
});

DualRangeSlider.displayName = 'DualRangeSlider';

export { DualRangeSlider };

