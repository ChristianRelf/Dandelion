import type { ReactElement } from 'react';
import * as RadixSlider from '@radix-ui/react-slider';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
}

export function Slider({ value, min, max, step = 1, onValueChange }: SliderProps): ReactElement {
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
      <RadixSlider.Thumb className="block h-3.5 w-3.5 rounded-full bg-white shadow outline-none" />
    </RadixSlider.Root>
  );
}
