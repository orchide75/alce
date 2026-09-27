import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build-ul produce un singur fișier dist/index.html care poate fi deschis
// direct din browser (dublu-click), fără server.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as never);
