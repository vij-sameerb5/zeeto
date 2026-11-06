import { mockAi, type AiDraft, type Unit } from '@zeeto/core';
import { api, feature, serverOn } from './api';

/**
 * Snap & Sell. With the server's Gemini key: real vision + translations (the key never reaches the browser).
 * Without it: sample stalls get the built-in sample draft (marked "AI mocked"); a real stall never gets made-up items:
 * typed text is read by a simple local parser, and photos ask for the key.
 */
export class AiOff extends Error {}

export const aiOn = () => feature('ai');

export async function snapDraft(photo: string, sample = false): Promise<AiDraft> {
  if (aiOn()) return (await api<{ draft: AiDraft }>('/api/ai', { body: { action: 'snap', image: photo } })).draft;
  if (sample || !serverOn()) return mockAi.snap(null);
  throw new AiOff('Photo reading needs the AI switched on (GEMINI_API_KEY in Vercel). For now, type what you have, e.g. "tacos 350 rupees, 20 plates".');
}

export async function voiceDraft(text: string, _sample = false): Promise<AiDraft> {
  if (aiOn()) return (await api<{ draft: AiDraft }>('/api/ai', { body: { action: 'voice', text } })).draft;
  return parseLocal(text); // typed text is read as typed, never swapped for sample items
}

const UNIT_WORDS: [RegExp, Unit][] = [
  [/\b(kg|kgs|kilo|kilos|kilogram)s?\b/i, 'kg'], [/\b(plate|plates|thali)\b/i, 'plate'], [/\b(cup|cups|glass|glasses)\b/i, 'cup'],
  [/\b(dozen|darjan)\b/i, 'dozen'], [/\b(bunch|bunches|gaddi)\b/i, 'bunch'], [/\b(250 ?g|pav kilo)\b/i, '250g'],
  [/\b(pc|pcs|piece|pieces|nos|each)\b/i, 'piece'],
];

/** "tacos 350 rupees, 20 plates; chai 15" → items. Price = number next to ₹/rs/rupees (else the first number); qty = number next to a unit. */
export function parseLocal(text: string): AiDraft {
  const t0 = Date.now();
  const raw = text.split(/[,;\n]| and | aur /i).map((s) => s.trim()).filter(Boolean);
  // "tacos, 400 rupees, 20 plates" → one item: glue a piece with no name onto the one before, and a name with no number onto the next.
  const bare = (p: string) => p.replace(/[\d₹/-]+|\b(rs\.?|inr|rupees?|rupaye|rupay|kg|kgs|kilos?|plates?|cups?|dozen|bunch(es)?|pcs?|pieces?|each|per|for|at)\b/gi, '').trim();
  const parts: string[] = [];
  for (const p of raw) {
    const last = parts[parts.length - 1];
    if (last !== undefined && (!bare(p) || !/\d/.test(last))) parts[parts.length - 1] = `${last} ${p}`;
    else parts.push(p);
  }
  const items: AiDraft['items'] = [];
  for (const p of parts) {
    const price = /(?:₹|rs\.?|inr)\s*(\d{1,6})|(\d{1,6})\s*(?:₹|rs\.?|rupees?|rupaye|rupay|inr|\/-)/i.exec(p);
    const unitHit = UNIT_WORDS.find(([re]) => re.test(p));
    const qtyM = unitHit ? new RegExp(`(\\d{1,5})\\s*${unitHit[0].source}`, 'i').exec(p) : null;
    const nums = [...p.matchAll(/\d{1,6}/g)].map((m) => Number(m[0]));
    const priceInr = price ? Number(price[1] ?? price[2]) : nums.find((n) => !qtyM || n !== Number(qtyM[1])) ?? 0;
    const name = p.replace(/(?:₹|rs\.?|inr)\s*\d+|\d+\s*(?:₹|rs\.?|rupees?|rupaye|rupay|inr|\/-)/gi, '').replace(/\d+/g, '')
      .replace(/\b(kg|kgs|kilo|kilos|plates?|cups?|dozen|bunch(es)?|pcs?|pieces?|each|per|for|at|of)\b/gi, '').replace(/\s+/g, ' ').trim();
    if (name.length < 2 || !priceInr) continue;
    items.push({ name: name[0].toUpperCase() + name.slice(1, 60), unit: unitHit?.[1] ?? 'piece', priceInr: Math.min(100000, priceInr), qty: qtyM ? Number(qtyM[1]) : 10, confidence: 0.6 });
  }
  return {
    run: { requestId: `local-${Date.now().toString(36)}`, model: 'Zeeto text reader (AI off)', ms: Date.now() - t0, at: new Date().toISOString(), simulated: false },
    items: items.slice(0, 8),
    alert: { title: items.length ? `Fresh today: ${items.map((i) => i.name).slice(0, 2).join(' & ')}` : '', body: items.length ? 'Order ahead on Zeeto and skip the wait.' : '', translations: {} },
  };
}
