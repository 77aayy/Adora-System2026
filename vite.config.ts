/**
 * Vite Configuration
 * PWA and build configuration
 * Adora Hotel Management System V2
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import * as fs from 'fs';
import * as path from 'path';

// ✅ Plugin to fix modulepreload order - vendor-react MUST load first
const fixModulePreloadOrder = () => {
    return {
        name: 'fix-modulepreload-order',
        enforce: 'post' as const,
        closeBundle() {
            // ✅ Run after all files are written
            const distPath = path.resolve(__dirname, 'dist');
            const indexPath = path.join(distPath, 'index.html');
            const assetsPath = path.join(distPath, 'assets');
            
            if (!fs.existsSync(indexPath)) return;
            
            let html = fs.readFileSync(indexPath, 'utf-8');
            
            // Extract all modulepreload links
            const preloadRegex = /<link rel="modulepreload"[^>]*href="([^"]+)"[^>]*>/g;
            const preloads: string[] = [];
            let match;
            
            while ((match = preloadRegex.exec(html)) !== null) {
                preloads.push(match[0]);
            }
            
            if (preloads.length === 0) return;
            
                // ✅ Sort preloads: vendor-core first (contains React + i18n + charts), then others
                // ✅ OPTIMIZED: Simplified sorting - vendor-core is already merged (React + i18next together)
                const sortOrder = (link: string): number => {
                    if (link.includes('vendor-core')) return 0; // Core MUST be first (React + i18n merged together)
                    if (link.includes('app-core')) return 1; // App core (contexts) loads after vendor-core
                    if (link.includes('vendor-firebase')) return 2;
                    if (link.includes('/vendor-')) return 3; // Other vendor chunks (export, icons, etc.)
                    if (link.includes('service-')) return 4;
                    if (link.includes('feature-')) return 5;
                    return 6;
                };
            
            const sortedPreloads = [...preloads].sort((a, b) => sortOrder(a) - sortOrder(b));
            
            // Remove all existing preloads
            let newHtml = html;
            for (const preload of preloads) {
                newHtml = newHtml.replace(preload, '');
            }
            
            // Add sorted preloads before </head>
            const preloadBlock = sortedPreloads.join('\n  ');
            newHtml = newHtml.replace('</head>', `  ${preloadBlock}\n</head>`);
            
            // Clean up extra whitespace
            newHtml = newHtml.replace(/\n\s*\n\s*\n/g, '\n\n');
            
            // ✅ Write back
            fs.writeFileSync(indexPath, newHtml, 'utf-8');
            console.log('✅ Fixed modulepreload order');
        },
    };
};

// ✅ Plugin removed - using direct script injection in index.html instead
// This prevents conflicts with MutationObserver code in index.html

export default defineConfig({
    plugins: [
        react(),
        // ✅ customizeViteOverlay removed - using index.html script instead to avoid MutationObserver conflicts
        fixModulePreloadOrder(),
        // PWA Configuration
        VitePWA({
            registerType: 'autoUpdate',
            devOptions: {
                enabled: false, // ✅ Disable PWA in development to avoid Service Worker interference
            },
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
            manifest: {
                name: 'Adora Hotel Management System',
                short_name: 'Adora',
                description: 'نظام إدارة الفنادق الذكي',
                theme_color: '#0D9488',
                background_color: '#0f172a',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/',
                scope: '/',
                icons: [
                    {
                        src: '/icon-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: '/icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: '/icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable',
                    },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                runtimeCaching: [
                    // ✅ Google Fonts - Cache forever
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                            },
                        },
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'gstatic-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                            },
                        },
                    },
                    // ✅ Firebase Storage (images) - Cache with revalidation
                    {
                        urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'firebase-images-cache',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                            },
                        },
                    },
                    // ✅ ImgBB Images - Cache with revalidation
                    {
                        urlPattern: /^https:\/\/(i\.ibb\.co|imgbb\.com)\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'imgbb-cache',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                            },
                        },
                    },
                    // ✅ API Calls - Network first, fallback to cache
                    {
                        urlPattern: /^https:\/\/.*\.googleapis\.com\/(v1|firestore)\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'api-cache',
                            networkTimeoutSeconds: 10,
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 5, // 5 minutes
                            },
                        },
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            '@': '/src',
            // ✅ Redirect lodash to lodash-es for proper ESM support
            // This fixes "does not provide an export named 'default'" errors
            'lodash': 'lodash-es',
        },
    },
    server: {
        port: 5173,
        host: true,
        strictPort: false,
        // ✅ Removed fixed hmr.port to let Vite use actual server port automatically
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'credentialless',
        },
    },
    // ✅ PERFORMANCE: Enable dependency pre-bundling
    optimizeDeps: {
        include: [
            'react', 
            'react-dom', 
            'react-router-dom',
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'lucide-react',
            // ✅ Use lodash-es for proper ESM support (lodash is CommonJS)
            'lodash-es',
            // ✅ CRITICAL: Include chart.js and react-chartjs-2 in pre-bundling
            // This ensures they are loaded early and added to modulepreload
            'chart.js',
            'react-chartjs-2',
            // ✅ Include recharts and its lodash dependency
            'recharts'
        ],
        // ✅ Exclude optional dependencies that may not be installed
        exclude: ['@sentry/react'],
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        // ✅ تحسين حجم الـ chunks - increased limit for better chunking strategy
        chunkSizeWarningLimit: 800,
        // ✅ Use esbuild for minification (safer than Terser, less aggressive)
        minify: 'esbuild',
        target: 'es2020',
        // ✅ CSS code splitting
        cssCodeSplit: true,
        // ✅ Optimize asset names - increased for better caching
        assetsInlineLimit: 8192, // Inline assets smaller than 8KB
        rollupOptions: {
            output: {
                // ✅ PERFORMANCE: Manual chunks for better code splitting and caching
                manualChunks: (id) => {
                    // ✅ OPTIMIZED: Simplified chunking - React + i18next merged to prevent "U before initialization" error
                    if (id.includes('node_modules')) {
                        // 1️⃣ Core Libraries (React + i18next) - MUST be together in same chunk to prevent initialization errors
                        if (id.includes('react') || id.includes('i18next')) {
                            return 'vendor-core'; // ✅ Merged together - prevents circular dependency and initialization errors
                        }
                        // Firebase - large library, separate chunk
                        if (id.includes('firebase')) {
                            return 'vendor-firebase';
                        }
                        // Other vendors - separate chunks for better caching
                        if (id.includes('xlsx') || id.includes('jspdf')) {
                            return 'vendor-export';
                        }
                        if (id.includes('lucide-react')) {
                            return 'vendor-icons';
                        }
                        // All other node_modules (including chart.js, react-chartjs-2, recharts) - goes to vendor-core
                        // This prevents circular dependencies and ensures proper initialization order
                        return 'vendor-core';
                    }
                    // 2️⃣ الـ Contexts الخاصة بينا (عشان مشكلة الـ U)
                    if (id.includes('/src/context/') || id.includes('/src/i18n/')) {
                        return 'app-core'; // افصل الـ contexts في chunk لوحدها تتحمل بدري
                    }
                    // Feature chunks - split large dashboards
                    if (id.includes('/features/reception/')) {
                        return 'feature-reception';
                    }
                    if (id.includes('/features/admin/')) {
                        return 'feature-admin';
                    }
                    if (id.includes('/features/super-admin/')) {
                        return 'feature-super-admin';
                    }
                    if (id.includes('/features/guest/')) {
                        return 'feature-guest';
                    }
                    // Service chunks - group services together
                    if (id.includes('/services/')) {
                        return 'services';
                    }
                    // Component chunks
                    if (id.includes('/components/')) {
                        return 'components';
                    }
                },
                // أسماء ملفات مُحسَّنة
                chunkFileNames: 'assets/[name]-[hash].js',
                entryFileNames: 'assets/[name]-[hash].js',
                assetFileNames: (assetInfo) => {
                    const info = assetInfo.name?.split('.') || [];
                    const ext = info[info.length - 1];
                    if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext || '')) {
                        return 'assets/images/[name]-[hash][extname]';
                    }
                    if (/woff2?|eot|ttf|otf/i.test(ext || '')) {
                        return 'assets/fonts/[name]-[hash][extname]';
                    }
                    return 'assets/[name]-[hash][extname]';
                },
            },
        },
    },
});
