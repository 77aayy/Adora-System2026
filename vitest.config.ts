/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // بيئة الاختبار
    environment: 'jsdom',
    
    // ملفات الإعداد
    setupFiles: ['./tests/setup.ts'],
    
    // تضمين الملفات
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    
    // استثناء
    exclude: ['node_modules', 'dist'],
    
    // التغطية
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/main.tsx',
      ],
    },
    
    // الإعدادات العامة
    globals: true,
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
