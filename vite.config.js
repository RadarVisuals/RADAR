// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { // Vitest configuration
    globals: true, // Allows using Vitest globals (describe, it, expect) without importing
    environment: 'jsdom', // Use JSDOM for testing React components
    setupFiles: './src/setupTests.js', // Your setup file
    css: true, // If you want to process CSS imports in tests
    env: { // Define environment variables for your tests
      DEV: 'true', // Makes import.meta.env.DEV available and true in tests
      // You can add other test-specific environment variables here
      // VITE_SOME_KEY: 'test_value' -> accessible as import.meta.env.VITE_SOME_KEY
    },
  },
});