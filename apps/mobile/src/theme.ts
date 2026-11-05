import { Platform } from 'react-native';

/** Same tokens as apps/web/tailwind.config.js. */
export const C = {
  bg: '#0A0A0A',
  panel: '#141414',
  raised: '#1F1F1F',
  line: 'rgba(250,248,243,0.08)',
  line2: 'rgba(250,248,243,0.16)',
  chalk: '#FAF8F3',
  mute: '#A1A1A1',
  dim: '#6B6B6B',
  z: '#FF7A1A',
  hot: '#FF5A00',
  ink: '#1A0B00',
  zSoft: 'rgba(255,122,26,0.13)',
  good: '#3DD68C',
  goodSoft: 'rgba(61,214,140,0.13)',
  warn: '#F5B83D',
};

export const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });
