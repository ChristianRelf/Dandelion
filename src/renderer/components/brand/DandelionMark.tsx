import type { ReactElement } from 'react';

interface DandelionMarkProps {
  className?: string;
}

const SPOKES = 13;
const CENTER_X = 32;
const CENTER_Y = 26;
const RADIUS = 18;

/** The Dandelion seed-head logo, drawn from `currentColor`. */
export function DandelionMark({ className }: DandelionMarkProps): ReactElement {
  const spokes = Array.from({ length: SPOKES }, (_, i) => {
    // Fan across the upper ~300° so the head reads as a seed puff above the stem.
    const angle = (-Math.PI * 5) / 6 + (i / (SPOKES - 1)) * ((Math.PI * 5) / 3);
    return {
      x: CENTER_X + Math.cos(angle) * RADIUS,
      y: CENTER_Y + Math.sin(angle) * RADIUS,
    };
  });

  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeLinecap="round">
        {/* Stem */}
        <path d="M32 26 C 31.5 38, 30 48, 26.5 59" strokeWidth={2.2} />
        {/* A single leaf */}
        <path d="M30 44 C 24 42, 20 44, 18 49 C 24 49, 28 48, 30 44 Z" strokeWidth={1.4} />
        {/* Seed filaments */}
        {spokes.map((point, i) => (
          <g key={i}>
            <line
              x1={CENTER_X}
              y1={CENTER_Y}
              x2={point.x}
              y2={point.y}
              strokeWidth={1.3}
              opacity={0.9}
            />
            <circle cx={point.x} cy={point.y} r={1.5} fill="currentColor" stroke="none" />
          </g>
        ))}
        {/* Two seeds drifting away */}
        <line x1={48} y1={14} x2={53} y2={9} strokeWidth={1.1} opacity={0.6} />
        <circle cx={53} cy={9} r={1.4} fill="currentColor" stroke="none" opacity={0.75} />
        <line x1={52} y1={22} x2={58} y2={20} strokeWidth={1.1} opacity={0.5} />
        <circle cx={58} cy={20} r={1.2} fill="currentColor" stroke="none" opacity={0.6} />
        {/* Core */}
        <circle cx={CENTER_X} cy={CENTER_Y} r={2.4} fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}
