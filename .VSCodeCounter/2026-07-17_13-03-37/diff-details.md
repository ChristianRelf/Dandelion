# Diff Details

Date : 2026-07-17 13:03:37

Directory c:\\Users\\chris\\Desktop\\dandilion

Total : 139 files,  15934 codes, 1603 comments, 1114 blanks, all 18651 lines

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [.github/workflows/release.yml](/.github/workflows/release.yml) | YAML | 38 | 6 | 11 | 55 |
| [README.md](/README.md) | Markdown | 19 | 0 | 5 | 24 |
| [ROADMAP.md](/ROADMAP.md) | Markdown | 52 | 0 | 4 | 56 |
| [Work/BUGS-FIXED.md](/Work/BUGS-FIXED.md) | Markdown | 747 | 0 | 224 | 971 |
| [Work/BUGS.md](/Work/BUGS.md) | Markdown | 93 | 0 | 10 | 103 |
| [Work/TODO.md](/Work/TODO.md) | Markdown | 48 | 0 | 9 | 57 |
| [build/icon.svg](/build/icon.svg) | XML | 25 | 0 | 1 | 26 |
| [docs/ARCHITECTURE.md](/docs/ARCHITECTURE.md) | Markdown | 19 | 0 | 4 | 23 |
| [docs/RELEASING.md](/docs/RELEASING.md) | Markdown | 69 | 0 | 29 | 98 |
| [electron-builder.yml](/electron-builder.yml) | YAML | 0 | 4 | 0 | 4 |
| [electron.vite.config.ts](/electron.vite.config.ts) | TypeScript | 27 | 24 | 3 | 54 |
| [eslint.config.mjs](/eslint.config.mjs) | JavaScript | 12 | 6 | 0 | 18 |
| [package.json](/package.json) | JSON | 2 | 0 | 0 | 2 |
| [scripts/generate-icon.cjs](/scripts/generate-icon.cjs) | JavaScript | 74 | 26 | 15 | 115 |
| [scripts/generate-public-suffix-list.cjs](/scripts/generate-public-suffix-list.cjs) | JavaScript | 85 | 48 | 23 | 156 |
| [src/main/app/app-context.ts](/src/main/app/app-context.ts) | TypeScript | 29 | 24 | 4 | 57 |
| [src/main/app/command-executor.ts](/src/main/app/command-executor.ts) | TypeScript | 3 | 9 | 1 | 13 |
| [src/main/app/media-protocol.ts](/src/main/app/media-protocol.ts) | TypeScript | 33 | 27 | 8 | 68 |
| [src/main/browser/dandelion-window.ts](/src/main/browser/dandelion-window.ts) | TypeScript | 2 | 1 | 0 | 3 |
| [src/main/browser/popup-host.ts](/src/main/browser/popup-host.ts) | TypeScript | 142 | 66 | 30 | 238 |
| [src/main/browser/tab-manager.ts](/src/main/browser/tab-manager.ts) | TypeScript | 112 | 124 | 14 | 250 |
| [src/main/browser/window-manager.ts](/src/main/browser/window-manager.ts) | TypeScript | 8 | 6 | 1 | 15 |
| [src/main/index.ts](/src/main/index.ts) | TypeScript | 5 | 3 | 1 | 9 |
| [src/main/ipc/ipc-host.ts](/src/main/ipc/ipc-host.ts) | TypeScript | 10 | 15 | 1 | 26 |
| [src/main/ipc/router.ts](/src/main/ipc/router.ts) | TypeScript | 1 | 0 | 0 | 1 |
| [src/main/ipc/routers/app.router.ts](/src/main/ipc/routers/app.router.ts) | TypeScript | 23 | 6 | 1 | 30 |
| [src/main/ipc/routers/browsing.router.ts](/src/main/ipc/routers/browsing.router.ts) | TypeScript | 0 | 1 | 0 | 1 |
| [src/main/ipc/routers/discovery.router.ts](/src/main/ipc/routers/discovery.router.ts) | TypeScript | 3 | 0 | 0 | 3 |
| [src/main/ipc/routers/sessions.router.ts](/src/main/ipc/routers/sessions.router.ts) | TypeScript | -3 | 1 | 0 | -2 |
| [src/main/ipc/routers/tabs.router.ts](/src/main/ipc/routers/tabs.router.ts) | TypeScript | 16 | 3 | 0 | 19 |
| [src/main/services/ai/ai.service.ts](/src/main/services/ai/ai.service.ts) | TypeScript | 29 | 42 | 8 | 79 |
| [src/main/services/bookmarks.service.ts](/src/main/services/bookmarks.service.ts) | TypeScript | 22 | 18 | 2 | 42 |
| [src/main/services/downloads.service.ts](/src/main/services/downloads.service.ts) | TypeScript | 58 | 99 | 6 | 163 |
| [src/main/services/extensions.service.ts](/src/main/services/extensions.service.ts) | TypeScript | 1 | 3 | 0 | 4 |
| [src/main/services/history.service.ts](/src/main/services/history.service.ts) | TypeScript | -1 | 3 | 0 | 2 |
| [src/main/services/permissions.service.ts](/src/main/services/permissions.service.ts) | TypeScript | 21 | 21 | 3 | 45 |
| [src/main/services/privacy/privacy.service.ts](/src/main/services/privacy/privacy.service.ts) | TypeScript | 24 | 14 | 5 | 43 |
| [src/main/services/privacy/public-suffix-list.ts](/src/main/services/privacy/public-suffix-list.ts) | TypeScript | 10,249 | 18 | 3 | 10,270 |
| [src/main/services/privacy/public-suffix.ts](/src/main/services/privacy/public-suffix.ts) | TypeScript | 29 | 41 | 13 | 83 |
| [src/main/services/privacy/third-party.ts](/src/main/services/privacy/third-party.ts) | TypeScript | 33 | 44 | 7 | 84 |
| [src/main/services/update.service.ts](/src/main/services/update.service.ts) | TypeScript | 93 | 61 | 18 | 172 |
| [src/main/storage/repositories/bookmarks.repo.ts](/src/main/storage/repositories/bookmarks.repo.ts) | TypeScript | 9 | 0 | 0 | 9 |
| [src/main/storage/repositories/downloads.repo.ts](/src/main/storage/repositories/downloads.repo.ts) | TypeScript | 1 | 22 | 3 | 26 |
| [src/main/storage/repositories/helpers.ts](/src/main/storage/repositories/helpers.ts) | TypeScript | 5 | 22 | 4 | 31 |
| [src/main/storage/repositories/history.repo.ts](/src/main/storage/repositories/history.repo.ts) | TypeScript | 5 | 1 | 0 | 6 |
| [src/renderer/components/chrome/BookmarksPanel.tsx](/src/renderer/components/chrome/BookmarksPanel.tsx) | TypeScript JSX | 5 | 2 | 0 | 7 |
| [src/renderer/components/chrome/ContentSlot.tsx](/src/renderer/components/chrome/ContentSlot.tsx) | TypeScript JSX | 7 | 6 | 0 | 13 |
| [src/renderer/components/chrome/DownloadRow.tsx](/src/renderer/components/chrome/DownloadRow.tsx) | TypeScript JSX | 104 | 5 | 7 | 116 |
| [src/renderer/components/chrome/DownloadsPanel.tsx](/src/renderer/components/chrome/DownloadsPanel.tsx) | TypeScript JSX | 59 | 6 | 8 | 73 |
| [src/renderer/components/chrome/DownloadsPopover.tsx](/src/renderer/components/chrome/DownloadsPopover.tsx) | TypeScript JSX | -91 | 8 | -5 | -88 |
| [src/renderer/components/chrome/HistoryPanel.tsx](/src/renderer/components/chrome/HistoryPanel.tsx) | TypeScript JSX | 98 | 7 | 9 | 114 |
| [src/renderer/components/chrome/PermissionPrompt.tsx](/src/renderer/components/chrome/PermissionPrompt.tsx) | TypeScript JSX | 3 | 3 | 0 | 6 |
| [src/renderer/components/chrome/Sidebar.tsx](/src/renderer/components/chrome/Sidebar.tsx) | TypeScript JSX | -129 | 2 | -11 | -138 |
| [src/renderer/components/chrome/SplitDivider.tsx](/src/renderer/components/chrome/SplitDivider.tsx) | TypeScript JSX | 106 | 20 | 12 | 138 |
| [src/renderer/components/chrome/TabContextMenu.tsx](/src/renderer/components/chrome/TabContextMenu.tsx) | TypeScript JSX | -11 | 3 | 0 | -8 |
| [src/renderer/components/chrome/TabSwitcher.tsx](/src/renderer/components/chrome/TabSwitcher.tsx) | TypeScript JSX | -2 | 0 | -1 | -3 |
| [src/renderer/components/chrome/TabsPanel.tsx](/src/renderer/components/chrome/TabsPanel.tsx) | TypeScript JSX | 130 | 5 | 14 | 149 |
| [src/renderer/components/chrome/TitleBar.tsx](/src/renderer/components/chrome/TitleBar.tsx) | TypeScript JSX | 3 | 1 | 1 | 5 |
| [src/renderer/components/chrome/Toolbar.tsx](/src/renderer/components/chrome/Toolbar.tsx) | TypeScript JSX | 20 | 6 | 2 | 28 |
| [src/renderer/components/chrome/UpdateChip.tsx](/src/renderer/components/chrome/UpdateChip.tsx) | TypeScript JSX | 154 | 21 | 10 | 185 |
| [src/renderer/components/chrome/ZoomControl.tsx](/src/renderer/components/chrome/ZoomControl.tsx) | TypeScript JSX | -8 | 9 | 2 | 3 |
| [src/renderer/components/palette/CommandPalette.tsx](/src/renderer/components/palette/CommandPalette.tsx) | TypeScript JSX | 26 | 6 | 2 | 34 |
| [src/renderer/components/reader/ReaderView.tsx](/src/renderer/components/reader/ReaderView.tsx) | TypeScript JSX | 11 | 5 | 0 | 16 |
| [src/renderer/components/sessions/SessionsDialog.tsx](/src/renderer/components/sessions/SessionsDialog.tsx) | TypeScript JSX | 18 | 0 | 1 | 19 |
| [src/renderer/components/ui/Favicon.tsx](/src/renderer/components/ui/Favicon.tsx) | TypeScript JSX | 4 | 9 | 1 | 14 |
| [src/renderer/components/ui/List.tsx](/src/renderer/components/ui/List.tsx) | TypeScript JSX | -4 | 0 | 0 | -4 |
| [src/renderer/components/ui/SegmentedControl.tsx](/src/renderer/components/ui/SegmentedControl.tsx) | TypeScript JSX | 15 | 7 | 1 | 23 |
| [src/renderer/components/ui/Slider.tsx](/src/renderer/components/ui/Slider.tsx) | TypeScript JSX | 14 | 9 | 0 | 23 |
| [src/renderer/components/ui/Switch.tsx](/src/renderer/components/ui/Switch.tsx) | TypeScript JSX | 6 | 5 | 0 | 11 |
| [src/renderer/components/ui/Tooltip.tsx](/src/renderer/components/ui/Tooltip.tsx) | TypeScript JSX | 0 | 11 | 0 | 11 |
| [src/renderer/hooks/useModalOverlay.ts](/src/renderer/hooks/useModalOverlay.ts) | TypeScript | 27 | 23 | 5 | 55 |
| [src/renderer/index.html](/src/renderer/index.html) | HTML | -3 | 9 | 0 | 6 |
| [src/renderer/lib/commands.ts](/src/renderer/lib/commands.ts) | TypeScript | 12 | 9 | 1 | 22 |
| [src/renderer/lib/history.ts](/src/renderer/lib/history.ts) | TypeScript | 33 | 9 | 4 | 46 |
| [src/renderer/lib/navigation.ts](/src/renderer/lib/navigation.ts) | TypeScript | 14 | 9 | 3 | 26 |
| [src/renderer/main.tsx](/src/renderer/main.tsx) | TypeScript JSX | -1 | 9 | 2 | 10 |
| [src/renderer/pages/AboutPage.tsx](/src/renderer/pages/AboutPage.tsx) | TypeScript JSX | 37 | 2 | 0 | 39 |
| [src/renderer/pages/ExtensionsPage.tsx](/src/renderer/pages/ExtensionsPage.tsx) | TypeScript JSX | 1 | 0 | 0 | 1 |
| [src/renderer/pages/HistoryPage.tsx](/src/renderer/pages/HistoryPage.tsx) | TypeScript JSX | -36 | -4 | -3 | -43 |
| [src/renderer/pages/SettingsPage.tsx](/src/renderer/pages/SettingsPage.tsx) | TypeScript JSX | 46 | 7 | 2 | 55 |
| [src/renderer/popup/PopupApp.tsx](/src/renderer/popup/PopupApp.tsx) | TypeScript JSX | 105 | 22 | 12 | 139 |
| [src/renderer/popup/usePopupTrigger.ts](/src/renderer/popup/usePopupTrigger.ts) | TypeScript | 34 | 13 | 6 | 53 |
| [src/renderer/providers/AppProvider.tsx](/src/renderer/providers/AppProvider.tsx) | TypeScript JSX | 8 | 0 | 1 | 9 |
| [src/renderer/stores/ai.store.ts](/src/renderer/stores/ai.store.ts) | TypeScript | 0 | 1 | 1 | 2 |
| [src/renderer/stores/browser.store.ts](/src/renderer/stores/browser.store.ts) | TypeScript | 15 | 8 | 2 | 25 |
| [src/renderer/stores/ui.store.ts](/src/renderer/stores/ui.store.ts) | TypeScript | 4 | 0 | 0 | 4 |
| [src/renderer/stores/update.store.ts](/src/renderer/stores/update.store.ts) | TypeScript | 26 | 25 | 8 | 59 |
| [src/renderer/styles/globals.css](/src/renderer/styles/globals.css) | PostCSS | 4 | 6 | 1 | 11 |
| [src/shared/constants/app.ts](/src/shared/constants/app.ts) | TypeScript | 2 | 16 | 2 | 20 |
| [src/shared/constants/commands.ts](/src/shared/constants/commands.ts) | TypeScript | 13 | 8 | 2 | 23 |
| [src/shared/constants/limits.ts](/src/shared/constants/limits.ts) | TypeScript | 1 | 1 | 0 | 2 |
| [src/shared/constants/settings.defaults.ts](/src/shared/constants/settings.defaults.ts) | TypeScript | 1 | 0 | 0 | 1 |
| [src/shared/schemas/ai.schema.ts](/src/shared/schemas/ai.schema.ts) | TypeScript | 2 | 1 | 0 | 3 |
| [src/shared/schemas/browsing.schema.ts](/src/shared/schemas/browsing.schema.ts) | TypeScript | -1 | 5 | 0 | 4 |
| [src/shared/schemas/popup.schema.ts](/src/shared/schemas/popup.schema.ts) | TypeScript | 15 | 5 | 4 | 24 |
| [src/shared/schemas/settings.schema.ts](/src/shared/schemas/settings.schema.ts) | TypeScript | 1 | 0 | 0 | 1 |
| [src/shared/schemas/tabs.schema.ts](/src/shared/schemas/tabs.schema.ts) | TypeScript | 4 | 1 | 1 | 6 |
| [src/shared/types/events.ts](/src/shared/types/events.ts) | TypeScript | 7 | 19 | 0 | 26 |
| [src/shared/types/index.ts](/src/shared/types/index.ts) | TypeScript | 2 | 0 | 0 | 2 |
| [src/shared/types/popup.ts](/src/shared/types/popup.ts) | TypeScript | 11 | 11 | 3 | 25 |
| [src/shared/types/settings.ts](/src/shared/types/settings.ts) | TypeScript | 1 | 5 | 0 | 6 |
| [src/shared/types/tab.ts](/src/shared/types/tab.ts) | TypeScript | 1 | 1 | 0 | 2 |
| [src/shared/types/update.ts](/src/shared/types/update.ts) | TypeScript | 20 | 20 | 2 | 42 |
| [src/shared/types/window.ts](/src/shared/types/window.ts) | TypeScript | 1 | 4 | 0 | 5 |
| [src/shared/utils/index.ts](/src/shared/utils/index.ts) | TypeScript | 1 | 0 | 0 | 1 |
| [src/shared/utils/split.ts](/src/shared/utils/split.ts) | TypeScript | 49 | 17 | 9 | 75 |
| [src/shared/utils/url.ts](/src/shared/utils/url.ts) | TypeScript | 15 | 30 | 2 | 47 |
| [tests/integration/components.test.tsx](/tests/integration/components.test.tsx) | TypeScript JSX | 16 | 8 | 3 | 27 |
| [tests/integration/control-labels.test.tsx](/tests/integration/control-labels.test.tsx) | TypeScript JSX | 39 | 10 | 5 | 54 |
| [tests/integration/overlay-focus.test.tsx](/tests/integration/overlay-focus.test.tsx) | TypeScript JSX | 70 | 14 | 17 | 101 |
| [tests/integration/permission-prompt.test.tsx](/tests/integration/permission-prompt.test.tsx) | TypeScript JSX | 56 | 5 | 13 | 74 |
| [tests/integration/update-chip.test.tsx](/tests/integration/update-chip.test.tsx) | TypeScript JSX | 60 | 2 | 11 | 73 |
| [tests/setup/renderer.setup.ts](/tests/setup/renderer.setup.ts) | TypeScript | 18 | 4 | 1 | 23 |
| [tests/unit/accelerator-label.test.ts](/tests/unit/accelerator-label.test.ts) | TypeScript | 25 | 6 | 6 | 37 |
| [tests/unit/ai-key-storage.test.ts](/tests/unit/ai-key-storage.test.ts) | TypeScript | 132 | 18 | 27 | 177 |
| [tests/unit/ai-service.test.ts](/tests/unit/ai-service.test.ts) | TypeScript | 99 | 14 | 16 | 129 |
| [tests/unit/bookmarks-service.test.ts](/tests/unit/bookmarks-service.test.ts) | TypeScript | 118 | 12 | 21 | 151 |
| [tests/unit/chrome-csp.test.ts](/tests/unit/chrome-csp.test.ts) | TypeScript | 35 | 13 | 8 | 56 |
| [tests/unit/downloads-service.test.ts](/tests/unit/downloads-service.test.ts) | TypeScript | 327 | 49 | 64 | 440 |
| [tests/unit/extensions-service.test.ts](/tests/unit/extensions-service.test.ts) | TypeScript | 52 | 6 | 11 | 69 |
| [tests/unit/history-grouping.test.ts](/tests/unit/history-grouping.test.ts) | TypeScript | 55 | 1 | 13 | 69 |
| [tests/unit/history-prune.test.ts](/tests/unit/history-prune.test.ts) | TypeScript | 44 | 6 | 7 | 57 |
| [tests/unit/like-escape.test.ts](/tests/unit/like-escape.test.ts) | TypeScript | 29 | 15 | 8 | 52 |
| [tests/unit/media-url.test.ts](/tests/unit/media-url.test.ts) | TypeScript | 29 | 6 | 6 | 41 |
| [tests/unit/permission-check.test.ts](/tests/unit/permission-check.test.ts) | TypeScript | 62 | 8 | 9 | 79 |
| [tests/unit/permission-request-window.test.ts](/tests/unit/permission-request-window.test.ts) | TypeScript | 85 | 12 | 17 | 114 |
| [tests/unit/popup-host.test.ts](/tests/unit/popup-host.test.ts) | TypeScript | 69 | 10 | 15 | 94 |
| [tests/unit/split-layout.test.ts](/tests/unit/split-layout.test.ts) | TypeScript | 68 | 3 | 16 | 87 |
| [tests/unit/tab-close-siblings.test.ts](/tests/unit/tab-close-siblings.test.ts) | TypeScript | 126 | 10 | 27 | 163 |
| [tests/unit/tab-defects.test.ts](/tests/unit/tab-defects.test.ts) | TypeScript | 117 | 13 | 20 | 150 |
| [tests/unit/tab-print.test.ts](/tests/unit/tab-print.test.ts) | TypeScript | 115 | 12 | 18 | 145 |
| [tests/unit/tab-webcontents.test.ts](/tests/unit/tab-webcontents.test.ts) | TypeScript | 163 | 17 | 29 | 209 |
| [tests/unit/tab-window-scope.test.ts](/tests/unit/tab-window-scope.test.ts) | TypeScript | 119 | 10 | 19 | 148 |
| [tests/unit/third-party.test.ts](/tests/unit/third-party.test.ts) | TypeScript | 168 | 31 | 30 | 229 |
| [tests/unit/unique-save-path.test.ts](/tests/unit/unique-save-path.test.ts) | TypeScript | 37 | 3 | 9 | 49 |
| [tests/unit/update-service.test.ts](/tests/unit/update-service.test.ts) | TypeScript | 207 | 6 | 48 | 261 |
| [tests/unit/update-store.test.ts](/tests/unit/update-store.test.ts) | TypeScript | 67 | 7 | 17 | 91 |
| [tests/unit/url.test.ts](/tests/unit/url.test.ts) | TypeScript | 17 | 5 | 3 | 25 |
| [tests/unit/web-content-url.test.ts](/tests/unit/web-content-url.test.ts) | TypeScript | 28 | 10 | 6 | 44 |

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details