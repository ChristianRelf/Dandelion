import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { PopupApp } from './popup/PopupApp';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Dandelion: #root element is missing from index.html');
}

/**
 * One bundle serves both the chrome and the popup surface that floats toolbar
 * popovers above the page — `PopupHost` loads this file with `?popup=1`. They
 * are separate web contents and cannot share a React tree; they share the
 * components, the tRPC client and the event bridge instead, which is the part
 * that matters.
 */
const isPopup = new URLSearchParams(window.location.search).get('popup') === '1';

// The surface is a native view floating over the page, so its body must not
// paint: the margin around the card is shadow, and the page has to show through.
if (isPopup) document.documentElement.dataset.surface = 'popup';

createRoot(container).render(<StrictMode>{isPopup ? <PopupApp /> : <App />}</StrictMode>);
