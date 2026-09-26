import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' assert { type: 'json' };
import { resolve } from 'path';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    rollupOptions: {
      input: {
        onboarding: resolve(__dirname, 'onboarding.html'),
        landing: resolve(__dirname, 'landing.html'),
        uninstall: resolve(__dirname, 'uninstall.html'),
        privacy: resolve(__dirname, 'privacy.html'),
      },
    },
  },
});
