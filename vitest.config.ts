import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import 'dotenv/config';

process.env.TZ = 'America/Sao_Paulo';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
});
