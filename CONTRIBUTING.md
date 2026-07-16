# Contributing to Dandelion

Thanks for helping build Dandelion. This guide keeps the codebase consistent and the review fast.

## Getting set up

See [docs/DEVELOPER.md](docs/DEVELOPER.md). In short: `npm install && npm run rebuild && npm run dev`.

## Before you open a PR

Run the full gate locally — all four must pass:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

For UI or engine changes, also run `npm run test:e2e` and include a screenshot/GIF.

## Code style

- **TypeScript, strict.** No `any` in new code (the lint rule warns); prefer precise types and
  discriminated unions. `noUncheckedIndexedAccess` is on — guard array/record access.
- **Formatting is Prettier.** Don't hand-format; run `npm run format`.
- **Naming:** `PascalCase` components/classes, `camelCase` values, `kebab-case` file names for
  services/routers (`*.service.ts`, `*.router.ts`), `PascalCase.tsx` for components.
- **Imports:** use the path aliases (`@shared`, `@main`, `@renderer`), and `import type` for types
  (enforced by lint).
- **Comments** explain _why_, not _what_. Match the density of the surrounding file. No TODOs on
  `main` — file an issue instead.

## Architectural conventions

- New renderer → main calls are **tRPC procedures** with a Zod input schema. No ad-hoc IPC.
- New reactive state is pushed as a typed **`BrowserEvent`**, applied in a Zustand store.
- Services depend on `Repositories`, not raw SQL. Add a migration rather than editing an applied one.
- Keep `shared` free of Electron and DOM imports.

See [docs/DEVELOPER.md](docs/DEVELOPER.md#adding-a-feature) for step-by-step recipes.

## Commits & PRs

- Conventional-commit style is appreciated: `feat(tabs): …`, `fix(omnibox): …`, `docs: …`.
- Keep PRs focused. Describe the change, the reasoning, and how you verified it.
- Add or update tests for behaviour changes; pure logic must have unit tests.

## Reporting bugs

Include your OS, the Dandelion version (Settings → About), reproduction steps, and any output from
the main-process logs (they are scoped, e.g. `dandelion:tabs`).
