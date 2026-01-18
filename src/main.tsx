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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    </I18nProvider>
  </React.StrictMode>
);