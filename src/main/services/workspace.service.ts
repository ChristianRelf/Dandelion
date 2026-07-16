import type { Workspace } from '@shared/types';
import { appError, type Result, err, ok } from '@shared/types';
import { createId } from '@shared/utils';
import { DEFAULT_ACCENT } from '@shared/constants';
import type { Repositories } from '../storage';
import type { EventBus } from '../core/event-bus';

export interface CreateWorkspaceInput {
  profileId: string;
  name: string;
  icon: string;
  accentColor: string;
}

/**
 * Manages Arc-style workspaces (spaces). A workspace organises tabs and provides
 * per-space theming; it references a profile whose cookie jar it shares.
 */
export class WorkspaceService {
  constructor(
    private readonly repos: Repositories,
    private readonly events: EventBus,
  ) {}

  ensureDefault(profileId: string): Workspace {
    const existing = this.repos.workspaces.listByProfile(profileId);
    if (existing.length > 0) return existing[0]!;

    const now = Date.now();
    const workspace: Workspace = {
      id: createId('ws'),
      profileId,
      name: 'Home',
      icon: 'house',
      accentColor: DEFAULT_ACCENT,
      wallpaper: null,
      order: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.repos.workspaces.insert(workspace);
    return workspace;
  }

  list(profileId: string): Workspace[] {
    return this.repos.workspaces.listByProfile(profileId);
  }

  listAll(): Workspace[] {
    return this.repos.workspaces.listAll();
  }

  get(id: string): Workspace | null {
    return this.repos.workspaces.get(id);
  }

  create(input: CreateWorkspaceInput): Workspace {
    const now = Date.now();
    const workspace: Workspace = {
      id: createId('ws'),
      profileId: input.profileId,
      name: input.name,
      icon: input.icon,
      accentColor: input.accentColor,
      wallpaper: null,
      order: this.repos.workspaces.nextOrder(input.profileId),
      createdAt: now,
      updatedAt: now,
    };
    this.repos.workspaces.insert(workspace);
    this.events.emit({ type: 'workspace:changed', workspace });
    return workspace;
  }

  update(
    id: string,
    patch: Partial<Pick<Workspace, 'name' | 'icon' | 'accentColor' | 'wallpaper' | 'order'>>,
  ): Result<Workspace> {
    const existing = this.repos.workspaces.get(id);
    if (!existing) return err(appError('workspace/not-found', 'Workspace not found'));
    this.repos.workspaces.update(id, patch);
    const workspace = this.repos.workspaces.get(id)!;
    this.events.emit({ type: 'workspace:changed', workspace });
    return ok(workspace);
  }

  reorder(orderedIds: string[]): void {
    this.repos.workspaces.reorder(orderedIds);
  }

  delete(id: string): Result<true> {
    const workspace = this.repos.workspaces.get(id);
    if (!workspace) return err(appError('workspace/not-found', 'Workspace not found'));
    const siblings = this.repos.workspaces.listByProfile(workspace.profileId);
    if (siblings.length <= 1) {
      return err(appError('workspace/last', 'A profile must keep at least one workspace'));
    }
    this.repos.workspaces.delete(id);
    return ok(true);
  }
}
