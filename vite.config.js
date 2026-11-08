import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const built = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

export default defineConfig({
  plugins: [
    react(),
    // Caches the app itself so it opens with no signal. Data requests are never cached here (see lib/offline.js).
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // public/manifest.webmanifest is used as is
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'], navigateFallback: '/index.html', navigateFallbackDenylist: [/^\/api\//], cleanupOutdatedCaches: true },
    }),
  ],
  server: { host: true },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(built),
  },
});
