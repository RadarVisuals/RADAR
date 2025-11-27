// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward calls to /api to the Netlify Functions server (default port 8888)
      '/api': {
        target: 'http://localhost:8888/.netlify/functions',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: { // Vitest configuration
    globals: true, 
    environment: 'jsdom', 
    setupFiles: './src/setupTests.js', 
    css: true, 
    env: { 
      DEV: 'true', 
    },
  },
});