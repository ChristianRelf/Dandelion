import type { ReactElement } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ImageOff } from 'lucide-react';
import { prettifyUrl } from '@shared/utils';
import { useTabPreviewStore } from '../../stores/tab-preview.store';

/** Floating thumbnail preview shown beside a hovered sidebar tab. Mount once. */
export function TabPreview(): ReactElement {
  const tabId = useTabPreviewStore((state) => state.tabId);
  const anchor = useTabPreviewStore((state) => state.anchor);
  const thumb = useTabPreviewStore((state) => state.thumb);
  const title = useTabPreviewStore((state) => state.title);
  const url = useTabPreviewStore((state) => state.url);

  const top = anchor ? Math.min(Math.max(anchor.top - 8, 8), window.innerHeight - 220) : 0;
  const left = anchor ? anchor.left + anchor.width + 10 : 0;

  return (
    <AnimatePresence>
      {tabId && anchor && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96, x: -6 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.96, x: -6 }}
          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
          style={{ top, left }}
          className="pointer-events-none fixed z-[75] w-72 overflow-hidden rounded-xl border border-line shadow-[var(--shadow-lg)] glass-strong"
        >
          <div className="flex aspect-[16/10] items-center justify-center border-b border-line bg-bg">
            {thumb ? (
              <img src={thumb} alt="" className="h-full w-full object-cover object-top" />
            ) : (
              <ImageOff className="h-6 w-6 text-faint" />
            )}
          </div>
          <div className="px-3 py-2">
            <p className="truncate text-[13px] font-medium text-text">{title || 'Untitled'}</p>
            <p className="truncate text-xs text-faint">{prettifyUrl(url)}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
