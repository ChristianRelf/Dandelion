export type CommandCategory =
  | 'navigation'
  | 'tabs'
  | 'workspaces'
  | 'view'
  | 'tools'
  | 'history'
  | 'bookmarks'
  | 'window'
  | 'developer'
  | 'app';

/**
 * Static metadata for a user-invocable command. Commands are the single
 * registry shared by the keyboard-shortcut system and the command palette, so
 * a binding and a palette entry always refer to the same canonical action.
 */
export interface CommandDescriptor {
  id: string;
  title: string;
  category: CommandCategory;
  /** Lucide icon name. */
  icon: string | null;
  /** Default accelerator, or `null` if unbound by default. */
  defaultKeys: string | null;
  /** Whether the command surfaces in the command palette. */
  palette: boolean;
  /** Optional keywords to improve palette fuzzy-search. */
  keywords?: string[];
}
