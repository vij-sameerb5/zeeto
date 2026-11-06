import { requireUser } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { env, has } from './_lib/env.js';
import { bad, body, off, route } from './_lib/http.js';
import { clip, draftSchema, gemini, PROMPT, toDraft } from './_lib/gemini.js';
import { ask } from './_lib/insights.js';

/**
 * Snap & Sell and translations with Google Gemini. The key stays on the server.
 * The model must answer in a fixed JSON shape; we validate it again before the app sees it, and a stall
 * always confirms prices before anything goes live.
 */
export default route(['POST'], async (req) => {
  const me = await requireUser(req); // signed-in only: stops strangers spending the AI budget
  if (!has.ai) throw off('AI (GEMINI_API_KEY)');
  const b = body<{ action?: string; image?: string; text?: string }>(req);

  let parts: unknown[];
  if (b.action === 'snap') {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image ?? ''));
    if (!m) throw bad('Send a JPEG, PNG or WebP photo.');
    if (m[2].length > 5_500_000) throw bad('Photo is too big. Use one under 4 MB.');
    parts = [{ inline_data: { mime_type: m[1], data: m[2] } }, { text: PROMPT }];
  } else if (b.action === 'voice') {
    const t = clip(b.text, 300);
    if (t.length < 2) throw bad('Say or type what you have today.');
    parts = [{ text: `${PROMPT}\n\nThe stall owner said (any language): """${t}"""` }];
  } else if (b.action === 'ask') {
    return ask(me.id, clip(b.text, 400));
  } else throw bad('Unknown action.');

  const { out, ms, requestId } = await gemini(parts, draftSchema);
  if (has.db) await db().from('ai_runs').insert({ id: requestId.slice(0, 60), kind: b.action, model: env.geminiModel, ms, ok: true });
  return { draft: toDraft(out, { requestId, ms }) };
}, { perMinute: 20 });

