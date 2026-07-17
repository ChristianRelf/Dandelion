import { describe, expect, it } from 'vitest';
import { initTRPC } from '@trpc/server';

import { resolveProcedure } from '@main/ipc/ipc-host';

/**
 * A router shaped like the real one — nested namespace, dotted path — built
 * here rather than imported so this stays a test of the lookup and of tRPC's
 * caller, not of the whole main process.
 */
function makeRouter() {
  const t = initTRPC.context<Record<string, never>>().create();
  const router = t.router({
    app: t.router({
      initialState: t.procedure.query(() => 'state'),
    }),
    tabs: t.router({
      create: t.procedure.mutation(() => 'created'),
    }),
  });
  const caller = t.createCallerFactory(router)({});
  const procedures: Record<string, unknown> = router._def.procedures;
  return { caller, procedures };
}

describe('resolveProcedure', () => {
  it('resolves a real procedure through the caller', async () => {
    const { caller, procedures } = makeRouter();
    const target = resolveProcedure(caller, 'app.initialState', procedures);

    expect(target).toBeTypeOf('function');
    await expect(target?.(undefined)).resolves.toBe('state');
  });

  it('resolves every procedure the router advertises', () => {
    const { caller, procedures } = makeRouter();

    for (const path of Object.keys(procedures)) {
      expect(resolveProcedure(caller, path, procedures), path).toBeTypeOf('function');
    }
  });

  /**
   * The regression. A tRPC caller is a Proxy trapping only `get`, so it reports
   * no own properties — an `Object.hasOwn` walk over it rejected every real
   * procedure and left the browser rendering an empty window. Pinned here
   * because it is a fact about the dependency, and a dependency can change it.
   */
  it('resolves procedures the caller does not expose as own properties', () => {
    const { caller, procedures } = makeRouter();

    expect(Object.hasOwn(caller, 'app')).toBe(false);
    expect(Object.keys(caller)).toEqual([]);
    expect(resolveProcedure(caller, 'app.initialState', procedures)).toBeTypeOf('function');
  });

  it('refuses paths the router does not serve', () => {
    const { caller, procedures } = makeRouter();

    expect(resolveProcedure(caller, 'app.nope', procedures)).toBeNull();
    expect(resolveProcedure(caller, 'nope', procedures)).toBeNull();
    expect(resolveProcedure(caller, '', procedures)).toBeNull();
  });

  it('refuses to walk onto the prototype chain', () => {
    const { caller, procedures } = makeRouter();

    expect(resolveProcedure(caller, 'constructor', procedures)).toBeNull();
    expect(resolveProcedure(caller, '__proto__.constructor.constructor', procedures)).toBeNull();
    expect(resolveProcedure(caller, 'app.constructor', procedures)).toBeNull();
    expect(resolveProcedure(caller, 'toString', procedures)).toBeNull();
  });

  /**
   * Why the registry check has to come first rather than back up the walk: the
   * caller is a *recursive* proxy, so every path down it yields a function and
   * only throws when called. `typeof target === 'function'` can therefore never
   * reject anything, and the registry is the only real gate.
   */
  it('cannot lean on the walk, because the caller answers to any path', () => {
    const { caller } = makeRouter();
    const nonsense = (caller as unknown as Record<string, Record<string, unknown>>)['nope']?.[
      'nothing'
    ];

    expect(nonsense).toBeTypeOf('function');
  });
});
