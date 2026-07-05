import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'next/headers': path.resolve(__dirname, '__tests__/stubs/next-headers.ts'),
      'next/navigation': path.resolve(__dirname, '__tests__/stubs/next-navigation.ts'),
      'next/server': path.resolve(__dirname, '__tests__/stubs/next-server.ts'),
    },
  },
});
