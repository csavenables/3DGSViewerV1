import { defineConfig } from 'vite';

export default defineConfig({
  base: '/3DGSViewerV1/',
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
