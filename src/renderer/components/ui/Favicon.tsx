import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { cn } from '../../lib/cn';

/** A favicon image that falls back to a globe glyph on error or when missing. */
export function Favicon({ src, className }: { src: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return <Globe className={cn('opacity-60', className)} strokeWidth={1.75} />;
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('rounded-[3px] object-contain', className)}
    />
  );
}
