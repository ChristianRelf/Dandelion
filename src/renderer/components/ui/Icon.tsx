import type { ComponentType, ReactElement } from 'react';
import { icons, type LucideProps } from 'lucide-react';

const EMOJI_RE = /\p{Extended_Pictographic}/u;

function toPascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

interface IconProps {
  /** A kebab-case Lucide icon name (e.g. `panel-left`) or an emoji. */
  name: string;
  className?: string;
  strokeWidth?: number;
}

/** Render a Lucide icon by name, or an emoji if the name is one. */
export function Icon({ name, className, strokeWidth = 1.75 }: IconProps): ReactElement {
  if (EMOJI_RE.test(name)) {
    return <span className={className}>{name}</span>;
  }
  const registry = icons as unknown as Record<string, ComponentType<LucideProps>>;
  const Component = registry[toPascalCase(name)] ?? registry.Globe!;
  return <Component className={className} strokeWidth={strokeWidth} />;
}
