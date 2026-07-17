import type { ReactElement } from 'react';
import * as RadixSlider from '@radix-ui/react-slider';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  /**
   * Accessible name for the thumb. Radix gives it `role="slider"` and the value,
   * but the thumb has no content and adjacent text is not an accessible name —
   * so without this it announces as "slider, 100".
   */
  'aria-label': string;
  /**
   * Spoken instead of the raw number where the number alone is meaningless —
   * "30 minutes" rather than "30".
   */
  valueText?: string;
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  'aria-label': ariaLabel,
  valueText,
}: SliderProps): ReactElement {
  return (
    <RadixSlider.Root
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(values) => onValueChange(values[0] ?? value)}
      className="relative flex h-5 w-40 touch-none items-center select-none"
    >
      <RadixSlider.Track className="relative h-1 flex-1 rounded-full bg-surface-active">
        <RadixSlider.Range className="absolute h-full rounded-full bg-accent" />
      </RadixSlider.Track>
      <RadixSlider.Thumb
        aria-label={ariaLabel}
        aria-valuetext={valueText}
        className="block h-3.5 w-3.5 rounded-full bg-white shadow"
      />
    </RadixSlider.Root>
  );
}
