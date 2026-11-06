/**
 * Turns a picked photo into a small JPEG data URL so it fits in local storage until uploads go to Supabase Storage.
 * Rejects anything that isn't an image or is over 12 MB before decoding it.
 */
export async function photoToDataUrl(file: File, max = 640): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Pick a photo (JPG, PNG or HEIC).');
  if (file.size > 12 * 1024 * 1024) throw new Error('That photo is over 12 MB.');
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error('Could not read that photo.'));
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(im.width, im.height));
    const c = document.createElement('canvas');
    c.width = Math.round(im.width * k);
    c.height = Math.round(im.height * k);
    c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.74); // ~40–90 KB: small enough to store and sync for every stall
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Accepts a YouTube URL or bare id and returns the 11-character id, or null. */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname)) return null;
    const id = u.hostname.endsWith('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v') ?? u.pathname.split('/').pop() ?? '';
    return /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Indian mobile number, 10 digits starting 6-9, optional +91. Returns +91XXXXXXXXXX or null. */
export function indianMobile(input: string): string | null {
  const d = input.replace(/[\s-]/g, '').replace(/^(\+?91)/, '');
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}
