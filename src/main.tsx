/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * Application Entry Point
 * Adora Hotel Management System V2
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/animations.css';
import './styles/design-system.css';
import './styles/guest-unified.css';

// Initialize i18n (Arabic/English)
import './i18n';

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

ReactDOM.createRoot(document.getElementById('root')!).render(
    <App />
);

