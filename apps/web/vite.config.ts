import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// `--mode single` builds one self-contained file (media inlined, in-memory routing) for sharing.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: single ? './' : '/',
    resolve: {
      alias: { '@zeeto/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)) },
      // Privy lists these as optional peers; resolve them from this app so the build finds them.
      dedupe: ['@solana/kit', '@solana-program/system', '@solana-program/token', '@solana-program/memo'],
    },
    define: { __SINGLE__: JSON.stringify(single) },
    build: single ? { assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 20_000 } : { chunkSizeWarningLimit: 2_000 },
    plugins: [
      react(),
      !single &&
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icon.svg'],
          workbox: { globPatterns: ['**/*.{js,css,html,svg}'], navigateFallbackDenylist: [/^\/api\//, /^\/checkout\.js$/] },
          manifest: {
            name: 'Zeeto',
            short_name: 'Zeeto',
            description: 'Find street vendors near you, order for pickup, pay in stablecoins.',
            theme_color: '#0A0A0A',
            background_color: '#0A0A0A',
            display: 'standalone',
            icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
          },
        }),
    ].filter(Boolean),
  };
});
