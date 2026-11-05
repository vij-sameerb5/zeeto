/// <reference types="vite/client" />
declare const __SINGLE__: boolean;

interface ImportMetaEnv {
  /** Public Privy app id. Without it the app runs in demo sign-in mode. */
  readonly VITE_PRIVY_APP_ID?: string;
  /** Public Mapbox token (pk.…), URL-restricted in the Mapbox console. Without it the offline street map is used. */
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_MAPBOX_STYLE?: string;
  /** Comma-separated Privy user ids, emails or +91 phone numbers that see /admin. UI gate only; the API enforces roles. */
  readonly VITE_ADMIN_USERS?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_STREETPAY_ADDRESS?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
