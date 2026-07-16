import { useEffect, useRef, type ReactElement } from 'react';
import { trpc } from '../../lib/trpc/client';
import { useUiStore } from '../../stores/ui.store';

interface ContentSlotProps {
  /** Pixels of the slot to reserve at the top for in-content overlays. */
  topInset?: number;
}

/**
 * A layout placeholder that measures its on-screen rect and reports it to the
 * main process, which positions the active tab's `WebContentsView` to exactly
 * cover it. The view renders on top of the chrome, so this element itself stays
 * empty. Bounds are rounded to whole pixels to avoid a subpixel seam.
 */
export function ContentSlot({ topInset = 0 }: ContentSlotProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const aiOpen = useUiStore((state) => state.aiSidebarOpen);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;

    const report = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        void trpc.layout.setContentBounds.mutate({
          x: Math.round(rect.x),
          y: Math.round(rect.y + topInset),
          width: Math.round(rect.width),
          height: Math.round(rect.height - topInset),
        });
      });
    };

    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    window.addEventListener('resize', report);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', report);
      cancelAnimationFrame(frame);
    };
  }, [sidebarCollapsed, aiOpen, topInset]);

  return <div ref={ref} className="h-full w-full" />;
}
