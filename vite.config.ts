/**
 * Vite Configuration
 * PWA and build configuration
 * Adora Hotel Management System V2
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        react(),
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
            'recharts',
            'lodash'
        ],
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        // ✅ تحسين حجم الـ chunks
        chunkSizeWarningLimit: 600,
        // ✅ تحسين الـ minification
        minify: 'terser',
        target: 'es2020', // Modern browsers for smaller bundles
        terserOptions: {
            compress: {
                drop_console: true, // إزالة console.log في الإنتاج
                drop_debugger: true,
                pure_funcs: ['console.log', 'console.info', 'console.warn', 'console.debug'], // إزالة جميع console
                passes: 3, // More passes for better compression
                ecma: 2020,
                unsafe: true,
                unsafe_arrows: true,
                unsafe_methods: true,
            },
            format: {
                comments: false, // Remove comments
                ecma: 2020,
            },
            mangle: {
                safari10: true,
            },
        },
        // ✅ CSS code splitting
        cssCodeSplit: true,
        // ✅ Optimize asset names
        assetsInlineLimit: 4096, // Inline assets smaller than 4KB
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    // ✅ Node modules
                    if (id.includes('node_modules')) {
                        // React core
                        if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
                            return 'vendor-react';
                        }
                        // React Router
                        if (id.includes('react-router')) {
                            return 'vendor-router';
                        }
                        // Firebase (large, separate chunk)
                        if (id.includes('firebase')) {
                            return 'vendor-firebase';
                        }
                        // Chart libraries
                        if (id.includes('chart.js') || id.includes('recharts')) {
                            return 'vendor-charts';
                        }
                        // UI libraries
                        if (id.includes('lucide-react')) {
                            return 'vendor-ui';
                        }
                        // Other node_modules
                        return 'vendor';
                    }
                    // ✅ Features by route (code splitting)
                    if (id.includes('/features/')) {
                        if (id.includes('/admin/')) return 'feature-admin';
                        if (id.includes('/reception/')) return 'feature-reception';
                        if (id.includes('/housekeeping/')) return 'feature-housekeeping';
                        if (id.includes('/bellman/')) return 'feature-bellman';
                        if (id.includes('/maintenance/')) return 'feature-maintenance';
                        if (id.includes('/procurement/')) return 'feature-procurement';
                        if (id.includes('/super-admin/')) return 'feature-super-admin';
                        if (id.includes('/coffeeshop/')) return 'feature-coffeeshop';
                        if (id.includes('/guest/')) return 'feature-guest';
                        if (id.includes('/auth/')) return 'feature-auth';
                        return 'feature-other';
                    }
                    // ✅ Services (lazy loaded)
                    if (id.includes('/services/')) {
                        if (id.includes('firebase')) return 'service-firebase';
                        if (id.includes('billing') || id.includes('payment')) return 'service-billing';
                        return 'service-core';
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
