import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      exclude: [
        'src/config/**',  // Exclude config files (static data)
        'test/**',        // Exclude test files
        '**/*.d.ts',      // Exclude type definitions
        'dist/**',        // Exclude build output
        'coverage/**',    // Exclude coverage reports
        '*.config.*',     // Exclude config files
      ],
      reporter: ['text', 'html', 'lcov'],
      lines: 80,
      functions: 75,
      branches: 70,
      statements: 80
    }
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});

