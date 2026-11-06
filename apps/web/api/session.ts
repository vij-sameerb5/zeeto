import { issueAppToken, requireUser } from './_lib/auth.js';
import { deny, route } from './_lib/http.js';

/**
 * POST /api/session: called by the /app-link page while you're signed in on the web, to hand the phone app its own
 * 7-day session (see issueAppToken). Only a signed-in web user can get one, and only for themselves.
 */
export default route(['POST'], async (req) => {
  if (String(req.headers.authorization ?? '').includes('zm1.')) throw deny('Sign in on the web to link the app.'); // no self-renewing app tokens
  const me = await requireUser(req);
  return { ...issueAppToken(me.id), address: me.address, label: me.label };
}, { perMinute: 10 });
