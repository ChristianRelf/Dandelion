import type { ReactElement } from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  /**
   * Accessible name. Radix gives the role and the state but cannot invent a
   * name: the thumb is empty, and adjacent text is not an accessible name — so
   * without this it announces as "switch, on".
   */
  'aria-label': string;
}

export function Switch({
  checked,
  onCheckedChange,
  'aria-label': ariaLabel,
}: SwitchProps): ReactElement {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel}
      className="relative h-[22px] w-[38px] shrink-0 rounded-full bg-surface-active transition-colors data-[state=checked]:bg-accent"
    >
      <RadixSwitch.Thumb className="block h-[18px] w-[18px] translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[18px]" />
    </RadixSwitch.Root>
  );
}
