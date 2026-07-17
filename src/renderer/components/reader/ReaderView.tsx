import { useEffect, type ReactElement } from 'react';
import { motion } from 'motion/react';
import { AArrowDown, AArrowUp, BookOpen, Pause, Play, Square, X } from 'lucide-react';
import type { ReaderArticle, ReaderTheme } from '@shared/types';
import { mediaUrl } from '@shared/utils';
import { cn } from '../../lib/cn';
import { IconButton } from '../ui/IconButton';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { useBrowserStore } from '../../stores/browser.store';
import { speechSupported, useReaderStore } from '../../stores/reader.store';

function readTime(length: number): string {
  const minutes = Math.max(1, Math.round(length / 1100));
  return `${minutes} min read`;
}

const THEME_OPTIONS: { value: ReaderTheme; label: string; icon: string }[] = [
  { value: 'auto', label: 'Auto', icon: 'monitor' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'sepia', label: 'Sepia', icon: 'coffee' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

function Block({
  block,
  profileId,
  spoken,
}: {
  block: ReaderArticle['blocks'][number];
  profileId: string;
  /** Being read aloud right now. */
  spoken: boolean;
}): ReactElement | null {
  // A wash of accent behind the block being read. Rounded and inset so it reads
  // as a highlighter over the text rather than a selection of the column.
  const mark = spoken ? 'rounded bg-accent-soft shadow-[0_0_0_4px_var(--accent-soft)]' : '';

  switch (block.type) {
    case 'h1':
    case 'h2':
      return <h2 className={cn('mt-8 mb-3 text-xl font-semibold text-text', mark)}>{block.text}</h2>;
    case 'h3':
      return <h3 className={cn('mt-6 mb-2 text-lg font-semibold text-text', mark)}>{block.text}</h3>;
    case 'li':
      return (
        <li className={cn('ml-5 list-disc py-0.5 text-text/90 marker:text-faint', mark)}>
          {block.text}
        </li>
      );
    case 'blockquote':
      return (
        <blockquote className={cn('my-4 border-l-2 border-accent pl-4 text-muted italic', mark)}>
          {block.text}
        </blockquote>
      );
    case 'pre':
      return (
        <pre
          className={cn(
            'my-4 scrollbar-slim overflow-x-auto rounded-lg bg-surface p-3 font-mono text-[13px] text-muted',
            mark,
          )}
        >
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
      return <p className={cn('my-4 leading-[1.75] text-text/90', mark)}>{block.text}</p>;
  }
}

/** Reader mode: a distraction-free rendering of the current page's article. */
export function ReaderView(): ReactElement {
  const article = useReaderStore((state) => state.article);
  const status = useReaderStore((state) => state.status);
  const close = useReaderStore((state) => state.close);
  const speechStatus = useReaderStore((state) => state.speechStatus);
  const spokenBlock = useReaderStore((state) => state.spokenBlock);
  const settings = useBrowserStore((state) => state.settings);
  const patchSettings = useBrowserStore((state) => state.patchSettings);
  // Names the session an image is fetched in. The reader only ever shows the
  // active tab's article, so the active profile is the one that loaded it.
  const profileId = useBrowserStore((state) => state.profile?.id) ?? '';

  const reader = settings?.reader;
  const fontScale = reader?.fontScale ?? 1;
  const theme = reader?.theme ?? 'auto';

  /**
   * Switching tabs unmounts the reader without closing it — `readerActive` in
   * ContentArea goes false while `reader.tabId` stays set. The engine is global
   * to the renderer, so without this the article would keep reading aloud from
   * a tab that is no longer on screen, with no visible control to stop it.
   */
  useEffect(() => () => useReaderStore.getState().stopSpeech(), []);

  const setFontScale = (next: number): void => {
    void patchSettings({ reader: { fontScale: Math.min(1.6, Math.max(0.8, next)) } });
  };

  const speech = useReaderStore.getState();
  const canSpeak = speechSupported && !!article;

  return (
    <div
      data-reader-theme={theme === 'auto' ? undefined : theme}
      className="relative flex h-full w-full flex-col bg-bg-elevated"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
        <BookOpen className="h-4 w-4 text-accent" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-muted">
          {article?.siteName || 'Reader'}
        </span>

        {canSpeak && (
          <>
            {speechStatus === 'idle' ? (
              <IconButton
                size="sm"
                onClick={() => speech.speak(reader?.speechRate ?? 1)}
                aria-label="Read article aloud"
                title="Read aloud"
              >
                <Play className="h-4 w-4" />
              </IconButton>
            ) : (
              <>
                <IconButton
                  size="sm"
                  onClick={() =>
                    speechStatus === 'playing' ? speech.pauseSpeech() : speech.resumeSpeech()
                  }
                  aria-label={speechStatus === 'playing' ? 'Pause reading' : 'Resume reading'}
                  title={speechStatus === 'playing' ? 'Pause' : 'Resume'}
                >
                  {speechStatus === 'playing' ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </IconButton>
                <IconButton
                  size="sm"
                  onClick={() => speech.stopSpeech()}
                  aria-label="Stop reading"
                  title="Stop"
                >
                  <Square className="h-4 w-4" />
                </IconButton>
              </>
            )}
            <span aria-hidden className="mx-0.5 h-4 w-px bg-line" />
          </>
        )}

        <SegmentedControl
          aria-label="Reader theme"
          size="sm"
          iconOnly
          // `iconOnly` is built for a full-width row and spreads its segments to
          // fill one. In a toolbar it has to hug its content instead.
          className="w-auto shrink-0"
          value={theme}
          onChange={(value) => void patchSettings({ reader: { theme: value } })}
          options={THEME_OPTIONS}
        />
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
                <Block
                  key={index}
                  block={block}
                  profileId={profileId}
                  spoken={spokenBlock === index}
                />
              ))}
            </div>
          </motion.article>
        )}
      </div>
    </div>
  );
}
