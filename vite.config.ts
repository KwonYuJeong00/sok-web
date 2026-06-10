import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built static site works regardless of where it is
// served from — Vercel (served at `/`), local `vite preview`, or a GitHub
// Pages project sub-path — without any per-host configuration.
export default defineConfig({
  base: './',
  plugins: [react()],
});
