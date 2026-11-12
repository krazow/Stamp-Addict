/**
 * Pop-up messages. On a phone this is React Native's own Alert; the web
 * version (alert.web.tsx) draws the same dialogs in the page, because
 * Alert does nothing in a browser.
 */
export { Alert } from 'react-native';

/** Renders web dialogs; nothing on a phone. */
export function AlertHost(): null {
  return null;
}
