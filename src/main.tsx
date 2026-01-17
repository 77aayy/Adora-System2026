/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * Application Entry Point
 * Adora Hotel Management System V2
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { I18nProvider } from './i18n/i18nContext';
import App from './App';
import './index.css';
import './styles/animations.css';
import './styles/design-system.css';
import './styles/guest-unified.css';

// Initialize i18n (Arabic/English)
import i18n from './i18n';

// ✅ CRITICAL: Pre-import Chart.js to ensure it's in the dependency graph
// This ensures vendor-chartjs is added to modulepreload automatically
import 'chart.js';
import 'react-chartjs-2';

// ✅ Force unregister Service Workers in development to prevent caching issues
if (import.meta.env.DEV) {
    // Unregister all service workers
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (const registration of registrations) {
                registration.unregister();
                console.log('🔄 Service Worker unregistered for fresh development');
            }
        });
    }
    
    // Clear all caches
    if ('caches' in window) {
        caches.keys().then((names) => {
            for (const name of names) {
                caches.delete(name);
                console.log(`🧹 Cache "${name}" cleared`);
            }
        });
    }
}

// ✅ CRITICAL: I18nProvider MUST be the absolute top parent
// It must wrap EVERYTHING, including StrictMode, to ensure usei18n hook is available everywhere
ReactDOM.createRoot(document.getElementById('root')!).render(
    <I18nProvider>
        <React.StrictMode>
            <I18nextProvider i18n={i18n}>
                <App />
            </I18nextProvider>
        </React.StrictMode>
    </I18nProvider>
);

