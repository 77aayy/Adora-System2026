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
            
            // Sort preloads: vendor-react first, then vendor, then vendor-firebase, then others
            const sortOrder = (link: string): number => {
                if (link.includes('vendor-react')) return 0;
                if (link.includes('/vendor-') && !link.includes('vendor-firebase')) return 1;
                if (link.includes('vendor-firebase')) return 2;
                if (link.includes('service-')) return 3;
                if (link.includes('feature-')) return 4;
                return 5;
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

export default defineConfig({
    plugins: [
        react(),
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
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        // ✅ تحسين حجم الـ chunks
        chunkSizeWarningLimit: 600,
        // ✅ Use esbuild for minification (safer than Terser, less aggressive)
        minify: 'esbuild',
        target: 'es2020',
        // ✅ CSS code splitting
        cssCodeSplit: true,
        // ✅ Optimize asset names
        assetsInlineLimit: 4096, // Inline assets smaller than 4KB
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    // ✅ ONLY split node_modules to avoid circular dependencies
                    if (id.includes('node_modules')) {
                        // ✅ React MUST be first and separate
                        if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
                            return 'vendor-react';
                        }
                        // ✅ Firebase (large) - separate chunk
                        if (id.includes('firebase')) {
                            return 'vendor-firebase';
                        }
                        // ✅ ALL OTHER node_modules (including charts) stay in ONE vendor chunk
                        // This fixes circular dependency issues with chart.js/recharts/d3
                        return 'vendor';
                    }
                    // Application code stays in main bundle
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
