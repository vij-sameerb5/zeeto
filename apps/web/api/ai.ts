import { requireUser } from './_lib/auth.js';
import { db } from './_lib/db.js';
import { env, has } from './_lib/env.js';
import { bad, body, HttpError, off, route } from './_lib/http.js';
import { newId, UNITS } from './_lib/shared.js';

/**
 * Snap & Sell and translations with Google Gemini. The key stays on the server.
 * The model must answer in a fixed JSON shape; we validate it again before the app sees it, and a stall
 * always confirms prices before anything goes live.
 */
const LANGS = { hi: 'Hindi', mr: 'Marathi', gu: 'Gujarati' } as const;

const draftSchema = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' }, local: { type: 'STRING' }, unit: { type: 'STRING', enum: [...UNITS] },
          priceInr: { type: 'INTEGER' }, qty: { type: 'INTEGER' }, confidence: { type: 'NUMBER' },
        },
        required: ['name', 'unit', 'priceInr', 'qty', 'confidence'],
      },
    },
    alert: {
      type: 'OBJECT',
      properties: { title: { type: 'STRING' }, body: { type: 'STRING' }, hi: { type: 'STRING' }, mr: { type: 'STRING' }, gu: { type: 'STRING' } },
      required: ['title', 'body', 'hi', 'mr', 'gu'],
    },
  },
  required: ['items', 'alert'],
};

const PROMPT = `You help a street stall in Mumbai list what it sells today.
Look at the input and list each distinct product you can sell (max 6).
Use plain English names, the common Hindi/Marathi name in "local" if there is one, a sensible unit,
a fair Mumbai street price in whole rupees, a rough quantity, and your confidence 0-1.
Then write a short note to the stall's followers (title under 50 chars, body under 140 chars), friendly, no emojis, no prices
it can't see, and translate the note into Hindi (hi), Marathi (mr) and Gujarati (gu).
Never invent health claims. If the input isn't stock for sale, return an empty items list.`;

async function gemini(parts: unknown[], schema: unknown) {
  const t = Date.now();
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.geminiModel)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.geminiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.3, maxOutputTokens: 2048 },
      safetySettings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }],
    }),
    signal: AbortSignal.timeout(25_000),
  });
  const ms = Date.now() - t;
  if (!r.ok) {
    console.error('[ai] gemini', r.status, (await r.text()).slice(0, 300));
    throw new HttpError(502, 'The AI didn’t answer. Try again, or add items by hand.');
  }
  const j = await r.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[]; responseId?: string };
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  try {
    return { out: JSON.parse(text) as Record<string, unknown>, ms, requestId: j.responseId ?? newId('ai', 6) };
  } catch {
    throw new HttpError(502, 'The AI answer was unreadable. Try again.');
  }
}

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

function toDraft(out: Record<string, unknown>, run: { requestId: string; ms: number }) {
  const items = (Array.isArray(out.items) ? out.items : []).slice(0, 6).map((x: Record<string, unknown>) => ({
    name: clip(x.name, 60) || 'Item',
    local: clip(x.local, 40) || undefined,
    unit: (UNITS as readonly string[]).includes(String(x.unit)) ? String(x.unit) : 'piece',
    priceInr: Math.min(100000, Math.max(1, Math.round(Number(x.priceInr) || 1))),
    qty: Math.min(10000, Math.max(1, Math.round(Number(x.qty) || 1))),
    confidence: Math.min(1, Math.max(0, Number(x.confidence) || 0.5)),
  }));
  const a = (out.alert ?? {}) as Record<string, unknown>;
  return {
    run: { requestId: run.requestId, model: env.geminiModel, ms: run.ms, at: new Date().toISOString(), simulated: false },
    items,
    alert: { title: clip(a.title, 60), body: clip(a.body, 200), translations: Object.fromEntries(Object.keys(LANGS).map((k) => [k, clip(a[k], 300)])) },
  };
}

export default route(['POST'], async (req) => {
  await requireUser(req); // signed-in only: stops strangers spending the AI budget
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
  } else throw bad('Unknown action.');

  const { out, ms, requestId } = await gemini(parts, draftSchema);
  if (has.db) await db().from('ai_runs').insert({ id: requestId.slice(0, 60), kind: b.action, model: env.geminiModel, ms, ok: true });
  return { draft: toDraft(out, { requestId, ms }) };
}, { perMinute: 20 });
