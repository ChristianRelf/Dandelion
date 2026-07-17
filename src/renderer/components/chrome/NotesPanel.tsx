import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ArrowLeft, Plus, StickyNote, Trash2 } from 'lucide-react';
import type { Note } from '@shared/types';
import { IconButton } from '../ui/IconButton';
import { Skeleton } from '../ui/Skeleton';
import { trpc } from '../../lib/trpc/client';
import { useBrowserStore } from '../../stores/browser.store';
import { useAsyncData } from '../../hooks/useAsyncData';
import { toast } from '../../stores/toast.store';

/** The first non-empty line, shown as the note's title in the list. */
function noteTitle(content: string): string {
  const line = content.split('\n').find((candidate) => candidate.trim().length > 0);
  return line?.trim() ?? 'Empty note';
}

/** The rest, previewed under the title. */
function notePreview(content: string): string {
  const lines = content.split('\n').filter((candidate) => candidate.trim().length > 0);
  return lines.slice(1).join(' ').trim();
}

function NoteEditor({
  note,
  onBack,
  onDelete,
}: {
  note: Note;
  onBack: () => void;
  onDelete: () => void;
}): ReactElement {
  const [draft, setDraft] = useState(note.content);
  // What is already persisted, so autosave (and the flush on the way out) skip a
  // no-op write that would only bump `updated_at` and reorder the list.
  const savedRef = useRef(note.content);
  // The latest draft, read by the unmount flush below without re-subscribing it.
  const draftRef = useRef(note.content);
  // Set on delete so no later save resurrects a note that is being removed.
  const abandonedRef = useRef(false);

  const save = (value: string): void => {
    if (abandonedRef.current || value === savedRef.current) return;
    savedRef.current = value;
    void trpc.notes.update
      .mutate({ id: note.id, content: value })
      .catch(() => toast.error('Failed to save note'));
  };

  // Debounced autosave while typing.
  useEffect(() => {
    draftRef.current = draft;
    if (draft === savedRef.current) return;
    const timer = setTimeout(() => save(draft), 500);
    return () => clearTimeout(timer);
  }, [draft]);

  // Flush the latest draft if the editor unmounts without a blur — the sidebar
  // collapsed by shortcut, another panel opened, or the window closed within the
  // debounce window. `save` is a no-op when nothing changed or the note was just
  // deleted, so this is safe on every close path.
  useEffect(() => () => save(draftRef.current), []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pt-1">
      <div className="flex items-center gap-1">
        <IconButton
          size="sm"
          aria-label="Back to notes"
          onClick={() => {
            save(draft);
            onBack();
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </IconButton>
        <span className="flex-1 truncate text-[12px] font-medium text-muted">
          {noteTitle(draft)}
        </span>
        <IconButton
          size="sm"
          aria-label="Delete note"
          onClick={() => {
            abandonedRef.current = true;
            onDelete();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => save(draft)}
        autoFocus
        placeholder="Write a note…"
        className="scrollbar-slim min-h-0 flex-1 resize-none rounded-lg bg-surface p-3 text-[13px] leading-relaxed text-text placeholder:text-faint focus:ring-1 focus:ring-accent focus:outline-none"
      />
    </div>
  );
}

/**
 * The sidebar's notes panel: a list of free-text notes, newest edit first. New
 * note opens an editor that autosaves as you type; the first line becomes the
 * title. The first place the app persists arbitrary user text.
 */
export function NotesPanel(): ReactElement {
  const profileId = useBrowserStore((state) => state.profile?.id);
  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    status,
    data: notes,
    reload,
  } = useAsyncData<Note[]>(
    () => (profileId ? trpc.notes.list.query({ profileId }) : Promise.resolve([])),
    [profileId],
    [],
  );

  const editing = editingId ? notes.find((note) => note.id === editingId) : undefined;
  // The list is refetched on the way back, so a note just opened is still in it.
  if (editingId && editing) {
    return (
      <NoteEditor
        note={editing}
        onBack={() => {
          setEditingId(null);
          reload();
        }}
        onDelete={() => {
          void trpc.notes.remove
            .mutate({ id: editing.id })
            .then(() => {
              setEditingId(null);
              reload();
            })
            .catch(() => toast.error('Failed to delete note'));
        }}
      />
    );
  }

  const create = (): void => {
    if (!profileId) return;
    void trpc.notes.create
      .mutate({ profileId })
      .then((note) => {
        reload();
        setEditingId(note.id);
      })
      .catch(() => toast.error('Failed to create note'));
  };

  const remove = (note: Note): void => {
    void trpc.notes.remove
      .mutate({ id: note.id })
      .then(() => reload())
      .catch(() => toast.error('Failed to delete note'));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pt-1">
      <button
        type="button"
        onClick={create}
        disabled={!profileId}
        className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong text-[12px] font-medium text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
        New note
      </button>

      <div className="flex scrollbar-slim min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-1">
        {status === 'loading' && notes.length === 0 ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="px-2 py-1.5">
              <Skeleton className="mb-1 h-3.5 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))
        ) : status === 'error' ? (
          <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
            <p className="text-[12px] text-faint">Couldn’t load your notes</p>
            <button
              type="button"
              onClick={reload}
              className="rounded px-2 py-1 text-[12px] text-accent hover:bg-surface-hover"
            >
              Retry
            </button>
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-faint">
            <StickyNote className="h-6 w-6" />
            <p className="text-[12px]">No notes yet.</p>
          </div>
        ) : (
          notes.map((note) => {
            const preview = notePreview(note.content);
            return (
              <div key={note.id} className="group/row flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditingId(note.id)}
                  className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-hover"
                >
                  <span className="truncate text-[13px] text-text">{noteTitle(note.content)}</span>
                  {preview && <span className="truncate text-[11px] text-faint">{preview}</span>}
                </button>
                <IconButton
                  size="sm"
                  aria-label={`Delete ${noteTitle(note.content)}`}
                  className="shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100"
                  onClick={() => remove(note)}
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
