import type { ReactElement } from 'react';
import type { InternalPageKey } from '@shared/constants';
import { NewTabPage } from './NewTabPage';
import { HistoryPage } from './HistoryPage';
import { DownloadsPage } from './DownloadsPage';
import { BookmarksPage } from './BookmarksPage';
import { PasswordsPage } from './PasswordsPage';
import { PermissionsPage } from './PermissionsPage';
import { CookiesPage } from './CookiesPage';
import { ExtensionsPage } from './ExtensionsPage';
import { SettingsPage } from './SettingsPage';
import { AboutPage } from './AboutPage';

/** Routes a `dandelion://` page key to its React page. */
export function InternalPage({ page }: { page: InternalPageKey }): ReactElement {
  switch (page) {
    case 'history':
      return <HistoryPage />;
    case 'downloads':
      return <DownloadsPage />;
    case 'bookmarks':
      return <BookmarksPage />;
    case 'passwords':
      return <PasswordsPage />;
    case 'permissions':
      return <PermissionsPage />;
    case 'cookies':
      return <CookiesPage />;
    case 'extensions':
      return <ExtensionsPage />;
    case 'settings':
      return <SettingsPage />;
    case 'about':
      return <AboutPage />;
    case 'newTab':
    default:
      return <NewTabPage />;
  }
}
