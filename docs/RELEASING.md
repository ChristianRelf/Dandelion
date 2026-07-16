# Releasing

How a build gets from this repository onto someone's machine, and how they get the next one.

## Cutting a release

Releases are deliberate. Nothing is published by merging to `main`.

1. Bump the version in `package.json`. electron-builder reads it, and the tag must match — a
   mismatch means the update feed advertises a version the installer does not contain.
2. Commit it: `chore: release v0.2.0`.
3. Tag and push:

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

4. The [Release workflow](../.github/workflows/release.yml) builds Windows and Linux in parallel. It
   runs typecheck, lint and the test suite first — a release cannot ship something the gate would
   reject.
5. It publishes a **draft** release. Nothing is downloadable and **no installed client is offered the
   update** until you publish it, so artifacts can be checked first.
6. Check the artifacts, write the notes, publish.

The workflow can also be run by hand from the Actions tab, which is useful for checking a build
without tagging.

## What gets built

| Platform    | Artifact                             | Auto-updates  |
| ----------- | ------------------------------------ | ------------- |
| Windows x64 | `Dandelion-<version>-x64.exe` (NSIS) | Yes           |
| Linux x64   | `.AppImage` and `.deb`               | AppImage only |

Alongside them, electron-builder publishes `latest.yml` / `latest-linux.yml` — the manifest
`electron-updater` reads to decide whether a newer version exists. **They are part of the release,
not incidental**: delete them and every installed client silently stops updating.

## What is deliberately not built

**macOS.** `electron-updater` cannot apply unsigned updates on macOS — Squirrel.Mac refuses them. An
unsigned DMG would install (after a right-click → Open past Gatekeeper) and then never update again,
which is worse than not shipping it. macOS needs an Apple Developer certificate ($99/yr) for signing
and notarisation first. The `mac:` block in `electron-builder.yml` is kept so that adding it later is
config, not archaeology.

**Windows arm64.** `better-sqlite3` ships no `win32-arm64` prebuild, so the target compiles it from
source and needs the ARM64 MSVC toolset, which fails on a stock runner. Windows on ARM runs the x64
build under emulation, so nobody is shut out. A native arm64 build needs a prebuilt binary for
`better-sqlite3`.

## The SmartScreen warning

Builds are **unsigned**. On Windows, SmartScreen will show "Windows protected your PC" and require
_More info → Run anyway_ the first time. This is expected and worth saying plainly in the release
notes rather than letting people wonder.

Signing needs an OV/EV code-signing certificate. When there is one, set `CSC_LINK` and
`CSC_KEY_PASSWORD` as repository secrets and electron-builder picks them up with no config change.

Auto-update itself works fine unsigned on Windows and Linux — signing removes the warning, not the
capability.

## How updates reach installed clients

Once a release is **published**:

1. Each client checks the GitHub Releases feed 15s after launch, and every 6 hours after that.
2. A newer version downloads in the background.
3. A chip appears in the toolbar. The update is applied when the user restarts — never underneath a
   live session, which would race session restore.

Users can turn the background checks off in **Settings → Behavior → Automatic updates**; the manual
check on the About page keeps working either way.

This means a broken release is not permanent: publish a higher version and clients pick it up within
six hours. It also means **the version number is the only thing that decides an update**, so never
re-tag or re-upload artifacts over a published release.

## The app icon

`build/icon.png` and `build/icon.svg` are committed artifacts, generated from the same seed-head
geometry the app draws:

```bash
npm run icon
```

Only needs re-running when the mark changes. electron-builder derives the Windows `.ico` and the
Linux icon set from the 1024px PNG.

## Verifying a build locally

`npm run dist` produces the installer in `dist/` without publishing. The packaged app is in
`dist/win-unpacked/` — run that rather than the dev tree to exercise the real asar bundle and the
unpacked `better-sqlite3` native module, which is where packaging problems actually surface.
