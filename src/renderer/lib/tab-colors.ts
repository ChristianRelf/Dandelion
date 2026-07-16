import type { TabGroupColor } from '@shared/types';

/** Display metadata for each tab-group colour. */
export const TAB_GROUP_COLORS: Record<TabGroupColor, { hex: string; label: string }> = {
  grey: { hex: '#9ca3af', label: 'Grey' },
  blue: { hex: '#60a5fa', label: 'Blue' },
  red: { hex: '#f87171', label: 'Red' },
  yellow: { hex: '#fbbf24', label: 'Yellow' },
  green: { hex: '#4ade80', label: 'Green' },
  pink: { hex: '#f472b6', label: 'Pink' },
  purple: { hex: '#a78bfa', label: 'Purple' },
  cyan: { hex: '#22d3ee', label: 'Cyan' },
  orange: { hex: '#fb923c', label: 'Orange' },
};

export const TAB_GROUP_COLOR_ORDER: TabGroupColor[] = [
  'blue',
  'green',
  'yellow',
  'red',
  'purple',
  'pink',
  'cyan',
  'orange',
  'grey',
];

/** Pick the next colour for a new group, cycling by existing group count. */
export function nextGroupColor(existingCount: number): TabGroupColor {
  return TAB_GROUP_COLOR_ORDER[existingCount % TAB_GROUP_COLOR_ORDER.length] ?? 'blue';
}
