import { env } from './env.js';
import { HttpError } from './http.js';
import { newId, UNITS } from './shared.js';

/** Google Gemini, called from the server only (the key never reaches a browser or WhatsApp). Answers must match a JSON schema. */
export const LANGS = { hi: 'Hindi', mr: 'Marathi', gu: 'Gujarati' } as const;

export const draftSchema = {
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

export const PROMPT = `You help a street stall in Mumbai list what it sells today.
Look at the input and list each distinct product you can sell (max 6).
Use plain English names, the common Hindi/Marathi name in "local" if there is one, a sensible unit,
a fair Mumbai street price in whole rupees, a rough quantity, and your confidence 0-1.
Then write a short note to the stall's followers (title under 50 chars, body under 140 chars), friendly, no emojis, no prices
it can't see, and translate the note into Hindi (hi), Marathi (mr) and Gujarati (gu).
Never invent health claims. If the input isn't stock for sale, return an empty items list.`;

export async function gemini(parts: unknown[], schema: unknown, opts: { temperature?: number; maxTokens?: number } = {}) {
  const t = Date.now();
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.geminiModel)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.geminiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: opts.temperature ?? 0.3, maxOutputTokens: opts.maxTokens ?? 2048 },
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

export const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export function toDraft(out: Record<string, unknown>, run: { requestId: string; ms: number }) {
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


export type Draft = ReturnType<typeof toDraft>;

/** Snap & Sell from a photo (base64) or from words. Returns a checked draft; nothing goes live until the stall confirms. */
export async function draftFrom(input: { image?: { mime: string; b64: string }; text?: string }) {
  const parts = input.image
    ? [{ inline_data: { mime_type: input.image.mime, data: input.image.b64 } }, { text: input.text ? `${PROMPT}\n\nThe stall owner added: """${clip(input.text, 300)}"""` : PROMPT }]
    : [{ text: `${PROMPT}\n\nThe stall owner said (any language): """${clip(input.text, 300)}"""` }];
  const { out, ms, requestId } = await gemini(parts, draftSchema);
  return { draft: toDraft(out, { requestId, ms }), ms, requestId };
}
