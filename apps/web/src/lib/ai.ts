import { mockAi, type AiDraft } from '@zeeto/core';
import { api, feature } from './api';

/**
 * Snap & Sell. With the server's Gemini key: real vision + translations (the key never reaches the browser).
 * Without it: the built-in sample draft, clearly marked simulated.
 */
export async function snapDraft(photo: string): Promise<AiDraft> {
  if (!feature('ai')) return mockAi.snap(null);
  return (await api<{ draft: AiDraft }>('/api/ai', { body: { action: 'snap', image: photo } })).draft;
}

export async function voiceDraft(text: string): Promise<AiDraft> {
  if (!feature('ai')) return mockAi.voice(null, text);
  return (await api<{ draft: AiDraft }>('/api/ai', { body: { action: 'voice', text } })).draft;
}
