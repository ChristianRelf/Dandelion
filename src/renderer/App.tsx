import type { ReactElement } from 'react';
import { AppProvider } from './providers/AppProvider';
import { Chrome } from './components/chrome/Chrome';

export function App(): ReactElement {
  return (
    <AppProvider>
      <Chrome />
    </AppProvider>
  );
}
