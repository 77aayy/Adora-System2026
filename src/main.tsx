// main.tsx
// 1. ✅ CSS أولاً (MUST load before any component to prevent FOUC)
import './index.css';
import './styles/animations.css';
import './styles/design-system.css';
import './styles/guest-unified.css';

// 2. ✅ i18n config (يُحمّل side effects ويأخذ instance) - SECOND, before React
import './i18n';

// 3. ✅ React الأساسيات
import React from 'react';
import ReactDOM from 'react-dom/client';

// 4. ✅ استيراد الـ Providers
import { I18nProvider } from './context/I18nContext';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n'; // تأكد إن المسار ده صح

// 5. ✅ التطبيق نفسه (آخر شيء)
import App from './App';

// ============================================================
// 🔐 SECURITY: Environment Validation (REQUIRED in Production)
// ============================================================

/**
 * Validate critical environment variables in production
 * 🔐 SECURITY: Throws error if required keys are missing
 */
if (import.meta.env.PROD) {
    const requiredEnvVars = [
        'VITE_ENCRYPTION_KEY',
    ] as const;

    const missingVars: string[] = [];
    const defaultValues: string[] = [];

    requiredEnvVars.forEach(varName => {
        const value = import.meta.env[varName];
        if (!value || (value === 'adora-default-encryption-key-change-in-production' && varName === 'VITE_ENCRYPTION_KEY')) {
            missingVars.push(varName);
            if (value === 'adora-default-encryption-key-change-in-production') {
                defaultValues.push(varName);
            }
        }
    });

    if (missingVars.length > 0) {
        const errorMessage = `
🚨 SECURITY ERROR: Missing or default environment variables in production!

Missing/Default Variables:
${missingVars.map(v => `  - ${v}${defaultValues.includes(v) ? ' (using default - NOT SECURE!)' : ' (not set)'}`).join('\n')}

Please set these variables in your .env file:
${missingVars.map(v => `  ${v}=your-secure-value-here`).join('\n')}

The application cannot run in production without these secure values.
        `.trim();

        // Show error in console and on page
        console.error(errorMessage);
        
        // Replace root content with error message (Turquoise Design - Professional)
        const root = document.getElementById('root');
        if (root) {
            root.innerHTML = `
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    padding: 2rem;
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
                    color: #f1f5f9;
                    font-family: 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                ">
                    <div style="
                        max-width: 650px;
                        width: 100%;
                        padding: 2.5rem;
                        background: rgba(32, 178, 170, 0.08);
                        backdrop-filter: blur(12px);
                        border: 2px solid rgba(32, 178, 170, 0.3);
                        border-radius: 1.25rem;
                        box-shadow: 0 20px 60px rgba(32, 178, 170, 0.15), 0 0 40px rgba(32, 178, 170, 0.1);
                    ">
                        <div style="
                            display: flex;
                            align-items: center;
                            gap: 0.75rem;
                            margin-bottom: 1.5rem;
                        ">
                            <div style="
                                width: 48px;
                                height: 48px;
                                border-radius: 12px;
                                background: linear-gradient(135deg, #20B2AA 0%, #14B8A6 100%);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                box-shadow: 0 8px 24px rgba(32, 178, 170, 0.3);
                            ">
                                <span style="font-size: 24px;">🔐</span>
                            </div>
                            <h1 style="
                                color: #20B2AA;
                                margin: 0;
                                font-size: 1.5rem;
                                font-weight: 700;
                                letter-spacing: -0.5px;
                            ">خطأ في الإعدادات الأمنية</h1>
                        </div>
                        <div style="
                            background: rgba(0, 0, 0, 0.4);
                            padding: 1.5rem;
                            border-radius: 0.875rem;
                            border: 1px solid rgba(32, 178, 170, 0.2);
                            margin-bottom: 1.5rem;
                        ">
                            <pre style="
                                margin: 0;
                                overflow-x: auto;
                                white-space: pre-wrap;
                                font-size: 0.875rem;
                                line-height: 1.75;
                                color: #e2e8f0;
                                font-family: 'Fira Code', 'Courier New', monospace;
                            ">${errorMessage}</pre>
                        </div>
                        <div style="
                            padding: 1rem;
                            background: rgba(32, 178, 170, 0.1);
                            border-radius: 0.75rem;
                            border-left: 4px solid #20B2AA;
                        ">
                            <p style="
                                margin: 0;
                                color: #94a3b8;
                                font-size: 0.875rem;
                                line-height: 1.6;
                            ">
                                <strong style="color: #20B2AA;">ملاحظة:</strong> يرجى التحقق من ملف <code style="background: rgba(0, 0, 0, 0.3); padding: 0.25rem 0.5rem; border-radius: 4px; font-family: monospace;">.env</code> والتأكد من تعيين جميع المفاتيح المطلوبة بشكل صحيح.
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Don't render React app
        throw new Error(errorMessage);
    }
}

// ✅ Hide initial loader after React mounts (prevent overlap with LoginScreen)
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    </I18nProvider>
  </React.StrictMode>
);

// ✅ Hide #initial-loader from index.html after React loads
setTimeout(() => {
  const initialLoader = document.getElementById('initial-loader');
  if (initialLoader) {
    initialLoader.style.transition = 'opacity 0.5s ease-out';
    initialLoader.style.opacity = '0';
    setTimeout(() => {
      initialLoader.style.display = 'none';
    }, 500);
  }
}, 100); // Hide after 100ms (React is already rendering)