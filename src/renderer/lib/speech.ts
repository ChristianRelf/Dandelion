import type { ReaderBlock } from '@shared/types';

export interface SpeechChunk {
  /** Index into the article's blocks, so the reader can highlight what is being read. */
  blockIndex: number;
  text: string;
}

/**
 * Longest utterance to queue, in characters.
 *
 * Speech is queued a sentence at a time rather than a paragraph at a time so
 * that stopping, and the highlight, land promptly: an utterance is atomic once
 * it starts, so a whole paragraph would be the smallest unit of both.
 */
const MAX_CHUNK = 220;

/**
 * Split on sentence ends, then re-join short sentences up to {@link MAX_CHUNK}.
 * A single sentence longer than the cap is left whole — breaking mid-clause
 * reads worse than a long one.
 */
function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let buffer = '';
  for (const part of parts) {
    if (!buffer) buffer = part;
    else if (buffer.length + part.length + 1 <= MAX_CHUNK) buffer += ` ${part}`;
    else {
      chunks.push(buffer);
      buffer = part;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

/**
 * Flatten an article into speakable chunks.
 *
 * Image blocks carry no `text`, only `alt`, and are skipped: reading alt text
 * aloud mid-article announces decoration as if it were prose.
 */
export function chunkArticle(blocks: readonly ReaderBlock[]): SpeechChunk[] {
  const chunks: SpeechChunk[] = [];
  blocks.forEach((block, blockIndex) => {
    if (block.type === 'img') return;
    const text = block.text?.trim();
    if (!text) return;
    for (const sentence of splitSentences(text)) chunks.push({ blockIndex, text: sentence });
  });
  return chunks;
}

export interface SpeechHandlers {
  /** The block now being read, or `null` once the article finishes. */
  onBlock: (blockIndex: number | null) => void;
  onDone: () => void;
}

/**
 * Reads an article aloud through the Web Speech API.
 *
 * The chrome is an ordinary Chromium renderer, so `speechSynthesis` is simply
 * there — no permission, nothing in the CSP governs it, and `sandbox: true`
 * restricts Node privileges rather than Web APIs.
 *
 * One instance per renderer, because the engine is per renderer: two windows
 * reading at once are two engines, and neither should be able to stop the
 * other. That is also why this is not app-global state.
 */
export class SpeechController {
  private chunks: SpeechChunk[] = [];
  private index = 0;
  private handlers: SpeechHandlers | null = null;
  private rate = 1;
  /**
   * Bumped whenever the queue is redirected — pause, stop, or a new article.
   *
   * `cancel()` fires `onend` for the utterance in flight, asynchronously and
   * indistinguishably from one finishing on its own, and that callback is what
   * queues the next chunk. Without a token to check itself against, cancelling
   * *starts the next sentence*. Each utterance closes over the generation it
   * was spoken in and does nothing if it is no longer current.
   */
  private generation = 0;

  static get supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  speak(chunks: SpeechChunk[], rate: number, handlers: SpeechHandlers): void {
    if (!SpeechController.supported || chunks.length === 0) {
      handlers.onDone();
      return;
    }
    this.stop();
    this.chunks = chunks;
    this.index = 0;
    this.rate = rate;
    this.handlers = handlers;
    this.next();
  }

  /**
   * Silence now, and stay silent.
   *
   * This cancels rather than calling `speechSynthesis.pause()`, because pause
   * does not hold: the native voice plays the current utterance out regardless,
   * `paused` flips back to false on its own, and reading carries on — so the
   * button would lie for as long as the sentence lasted. Cancelling stops the
   * sound immediately, and {@link resume} re-speaks the current sentence from
   * its start, which is the granularity the queue already works at.
   */
  pause(): void {
    if (!SpeechController.supported) return;
    this.generation += 1;
    window.speechSynthesis.cancel();
  }

  resume(): void {
    if (!SpeechController.supported || !this.handlers) return;
    this.next();
  }

  stop(): void {
    if (!SpeechController.supported) return;
    this.generation += 1;
    // `cancel` alone leaves a paused engine paused, so a later `speak` would
    // queue behind a stop that never comes and nothing would be heard.
    window.speechSynthesis.resume();
    window.speechSynthesis.cancel();
    this.chunks = [];
    this.index = 0;
    this.handlers = null;
  }

  private next(): void {
    const chunk = this.chunks[this.index];
    const handlers = this.handlers;
    if (!handlers) return;
    if (!chunk) {
      handlers.onBlock(null);
      handlers.onDone();
      this.chunks = [];
      this.index = 0;
      this.handlers = null;
      return;
    }

    const generation = (this.generation += 1);
    const isCurrent = (): boolean => this.generation === generation && this.handlers === handlers;

    handlers.onBlock(chunk.blockIndex);
    const utterance = new SpeechSynthesisUtterance(chunk.text);
    utterance.rate = this.rate;
    utterance.onend = () => {
      if (!isCurrent()) return;
      this.index += 1;
      this.next();
    };
    utterance.onerror = () => {
      if (!isCurrent()) return;
      // A voice that fails on one chunk should not take the article down with
      // it; skip to the next rather than stall on a silent reader.
      this.index += 1;
      this.next();
    };
    window.speechSynthesis.speak(utterance);
  }
}
