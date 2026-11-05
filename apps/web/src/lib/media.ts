/** Media key ("veg-1", "hero-wide") → hashed asset URL. Uploads (data:/blob:/http) pass through. */
const files = import.meta.glob('../media/*.{jpg,mp4}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const map: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  const m = path.match(/media\/(.+)\.(jpg|mp4)$/);
  if (m) map[m[2] === 'mp4' ? `${m[1]}.mp4` : m[1]] = url;
}
export const img = (key?: string) => (!key ? '' : /^(data:|blob:|https?:)/.test(key) ? key : map[key] ?? '');
export const vid = (key: string) => map[`${key}.mp4`] ?? '';
