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

// ✅ Plugin removed - using direct script injection in index.html instead

// ✅ Plugin to customize Vite Error Overlay with Adora Theme
const customizeViteOverlay = () => {
    return {
        name: 'customize-vite-overlay',
        enforce: 'pre' as const,
        configureServer(server) {
            // Inject custom overlay styles via middleware
            server.middlewares.use((req, res, next) => {
                if (req.url === '/@vite/client' || req.url?.includes('vite')) {
                    // This runs on every request - we'll inject via transformIndexHtml instead
                }
                next();
            });
        },
        transformIndexHtml(html: string) {
            // Inject aggressive overlay styling script
            const overlayScript = `
                <script>
                    (function() {
                        var styled = false;
                        
                        function injectOverlayStyles() {
                            var overlay = document.querySelector('vite-error-overlay');
                            if (!overlay) return;
                            
                            var shadowRoot = overlay.shadowRoot;
                            if (!shadowRoot) return;
                            
                            if (shadowRoot.querySelector('style[data-adora-theme]')) {
                                styled = true;
                                return;
                            }
                            
                            // Get theme colors
                            var root = document.documentElement;
                            var getColor = function(v) {
                                return getComputedStyle(root).getPropertyValue(v).trim() || 
                                       (v.includes('bg') ? '#ffffff' : 
                                        v.includes('text') ? '#1e293b' : 
                                        v.includes('primary') ? '#0d9488' : 
                                        v.includes('red') ? '#dc2626' : '#cbd5e1');
                            };
                            
                            var bgSecondary = getColor('--theme-bg-secondary');
                            var bgTertiary = getColor('--theme-bg-tertiary');
                            var borderPrimary = getColor('--theme-border-primary');
                            var textPrimary = getColor('--theme-text-primary');
                            var textSecondary = getColor('--theme-text-secondary');
                            var textTertiary = getColor('--theme-text-tertiary');
                            var primary600 = getColor('--theme-primary-600');
                            var primary700 = getColor('--theme-primary-700');
                            var accentRedDark = getColor('--theme-accent-red-dark');
                            var shadowCard = getColor('--theme-shadow-card') || '0 4px 16px rgba(0, 0, 0, 0.15)';
                            
                            var style = document.createElement('style');
                            style.setAttribute('data-adora-theme', 'true');
                            style.textContent = \`
                                * {
                                    font-family: 'Cairo', 'Tajawal', sans-serif !important;
                                }
                                :host {
                                    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%) !important;
                                }
                                .overlay, .container, .wrapper, [class*="overlay"], div {
                                    background: \${bgSecondary} !important;
                                    border: 1px solid \${borderPrimary} !important;
                                    border-radius: 24px !important;
                                    box-shadow: \${shadowCard} !important;
                                    color: \${textPrimary} !important;
                                    padding: 24px !important;
                                }
                                .message, .title, h1, h2, h3 {
                                    color: \${accentRedDark} !important;
                                    font-weight: 600 !important;
                                }
                                .file, code, pre {
                                    color: \${primary600} !important;
                                    font-weight: 500 !important;
                                }
                                .stack, .frame, pre {
                                    color: \${textTertiary} !important;
                                    background: \${bgTertiary} !important;
                                    border: 1px solid \${borderPrimary} !important;
                                    border-radius: 12px !important;
                                    padding: 12px !important;
                                }
                                button, .dismiss, .btn {
                                    background: \${primary600} !important;
                                    border: none !important;
                                    border-radius: 12px !important;
                                    color: white !important;
                                    font-weight: 700 !important;
                                    padding: 10px 20px !important;
                                }
                                button:hover, .dismiss:hover {
                                    background: \${primary700} !important;
                                    transform: translateY(-2px) !important;
                                }
                                p, span {
                                    color: \${textSecondary} !important;
                                }
                            \`;
                            
                            shadowRoot.insertBefore(style, shadowRoot.firstChild);
                            styled = true;
                            console.log('✅ Adora theme applied to Vite overlay');
                        }
                        
                        // Aggressive injection
                        setInterval(injectOverlayStyles, 50);
                        new MutationObserver(injectOverlayStyles).observe(document.body, { 
                            childList: true, subtree: true 
                        });
                        requestAnimationFrame(function raf() {
                            injectOverlayStyles();
                            requestAnimationFrame(raf);
                        });
                    })();
                </script>
            `;
            return html.replace('</head>', overlayScript + '</head>');
        },
    };
};

export default defineConfig({
    plugins: [
        react(),
        customizeViteOverlay(), // ✅ Customize Vite Error Overlay
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
                    // Vendor chunks - separate by library
                    if (id.includes('node_modules')) {
                        // React core
                        if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                            return 'vendor-react';
                        }
                        // Firebase - large library, separate chunk
                        if (id.includes('firebase')) {
                            return 'vendor-firebase';
                        }
                        // Chart libraries - heavy, separate chunk
                        if (id.includes('chart.js') || id.includes('recharts') || id.includes('react-chartjs')) {
                            return 'vendor-charts';
                        }
                        // Other large vendors
                        if (id.includes('xlsx') || id.includes('jspdf')) {
                            return 'vendor-export';
                        }
                        // i18n libraries
                        if (id.includes('i18next') || id.includes('react-i18next')) {
                            return 'vendor-i18n';
                        }
                        // Lucide icons - large but frequently used
                        if (id.includes('lucide-react')) {
                            return 'vendor-icons';
                        }
                        // All other node_modules
                        return 'vendor';
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
