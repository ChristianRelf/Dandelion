/**
 * Toolbar popovers that must float **above** the page.
 *
 * Tab content is a native `WebContentsView` sitting on top of the chrome in the
 * content region, so a popover rendered by the chrome and anchored to a toolbar
 * button drops straight underneath it — invisible, and unclickable, because the
 * view swallows the pointer too. These are hosted in their own always-on-top
 * surface instead. See `PopupHost`.
 */
export type PopupKind = 'downloads' | 'update' | 'zoom';

/** A trigger's on-screen rectangle, in the chrome's CSS pixels (= DIP). */
export interface PopupAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What the popup renderer measured itself to need, in DIP. */
export interface PopupSize {
  width: number;
  height: number;
}
