import * as WebBrowser from 'expo-web-browser';

/**
 * The web app (deployed, or a tunnel to your laptop). Sign-in and payments open there, because Privy's
 * native SDK needs a development build and doesn't run in Expo Go. Set EXPO_PUBLIC_WEB_URL in apps/mobile/.env.
 */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? '').replace(/\/+$/, '');

/** Only our own pay links are allowed: /pay/r/<id> (bill QR) or /p/<stall> (printed shop QR). */
export function zeetoPayLink(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    const base = WEB_URL ? new URL(WEB_URL) : null;
    if (!base || u.origin !== base.origin) return null;
    return /^\/(pay\/r\/[\w-]{4,40}|p\/[\w-]{2,40})\/?$/.test(u.pathname) ? u.toString() : null;
  } catch {
    return null;
  }
}

export const openWeb = (pathOrUrl: string) =>
  WebBrowser.openBrowserAsync(pathOrUrl.startsWith('http') ? pathOrUrl : `${WEB_URL}${pathOrUrl}`, {
    toolbarColor: '#0A0A0A',
    controlsColor: '#FF7A1A',
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
