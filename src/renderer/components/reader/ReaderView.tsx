import type { ReactElement } from 'react';
import { motion } from 'motion/react';
import { AArrowDown, AArrowUp, BookOpen, X } from 'lucide-react';
import type { ReaderArticle } from '@shared/types';
import { mediaUrl } from '@shared/utils';
import { IconButton } from '../ui/IconButton';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { useBrowserStore } from '../../stores/browser.store';
import { useReaderStore } from '../../stores/reader.store';

function readTime(length: number): string {
  const minutes = Math.max(1, Math.round(length / 1100));
  return `${minutes} min read`;
}

function Block({
  block,
  profileId,
}: {
  block: ReaderArticle['blocks'][number];
  profileId: string;
}): ReactElement | null {
  switch (block.type) {
    case 'h1':
    case 'h2':
      return <h2 className="mt-8 mb-3 text-xl font-semibold text-text">{block.text}</h2>;
    case 'h3':
      return <h3 className="mt-6 mb-2 text-lg font-semibold text-text">{block.text}</h3>;
    case 'li':
      return <li className="ml-5 list-disc py-0.5 text-text/90 marker:text-faint">{block.text}</li>;
    case 'blockquote':
      return (
        <blockquote className="my-4 border-l-2 border-accent pl-4 text-muted italic">
          {block.text}
        </blockquote>
      );
    case 'pre':
      return (
        <pre className="my-4 scrollbar-slim overflow-x-auto rounded-lg bg-surface p-3 font-mono text-[13px] text-muted">
          {block.text}
        </pre>
      );
    case 'img': {
      // The page chose this URL. The chrome has no session, so fetching it here
      // would land it in the default session — outside the profile partition and
      // outside the block engine — which is the same leak favicons had.
      const src = block.src ? mediaUrl(profileId, block.src) : null;
      return src ? (
        <img
          src={src}
          alt={block.alt ?? ''}
          loading="lazy"
          className="my-5 max-h-[70vh] w-full rounded-lg object-contain"
        />
      ) : null;
    }
    default:
      return <p className="my-4 leading-[1.75] text-text/90">{block.text}</p>;
  }
}

/** Reader mode: a distraction-free rendering of the current page's article. */
export function ReaderView(): ReactElement {
  const article = useReaderStore((state) => state.article);
  const status = useReaderStore((state) => state.status);
  const fontScale = useReaderStore((state) => state.fontScale);
  const close = useReaderStore((state) => state.close);
  const setFontScale = useReaderStore((state) => state.setFontScale);
  // Names the session an image is fetched in. The reader only ever shows the
  // active tab's article, so the active profile is the one that loaded it.
  const profileId = useBrowserStore((state) => state.profile?.id) ?? '';

  return (
    <div className="relative flex h-full w-full flex-col bg-bg-elevated">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
        <BookOpen className="h-4 w-4 text-accent" />
        <span className="flex-1 truncate text-[13px] font-medium text-muted">
          {article?.siteName || 'Reader'}
        </span>
        <IconButton
          size="sm"
          onClick={() => setFontScale(fontScale - 0.1)}
          aria-label="Decrease text size"
        >
          <AArrowDown className="h-4 w-4" />
        </IconButton>
        <IconButton
          size="sm"
          onClick={() => setFontScale(fontScale + 0.1)}
          aria-label="Increase text size"
        >
          <AArrowUp className="h-4 w-4" />
        </IconButton>
        <IconButton size="sm" onClick={close} aria-label="Exit reader mode">
          <X className="h-4 w-4" />
        </IconButton>
      </header>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto">
        {status === 'loading' && (
          <div className="flex h-full items-center justify-center">
            <Spinner size={22} className="text-muted" />
          </div>
        )}
        {status === 'error' && (
          <EmptyState
            icon="book-dashed"
            title="Reader mode unavailable"
            description="This page doesn't have article content that can be distilled."
            action={
              <Button variant="secondary" size="sm" onClick={close}>
                Back to page
              </Button>
            }
          />
        )}
        {article && status === 'idle' && (
          <motion.article
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            style={{ fontSize: `${fontScale}rem` }}
            className="mx-auto max-w-[720px] px-8 py-12"
          >
            <h1 className="text-[2em] leading-tight font-bold text-text">{article.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-faint">
              {article.byline && <span className="text-muted">{article.byline}</span>}
              {article.byline && <span>·</span>}
              <span>{readTime(article.length)}</span>
            </div>
            <div className="mt-8 text-[1rem]">
              {article.blocks.map((block, index) => (
                <Block key={index} block={block} profileId={profileId} />
              ))}
            </div>
          </motion.article>
        )}
      </div>
    </div>
  );
}
