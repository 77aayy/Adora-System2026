// main.tsx
// 1. ✅ CSS أولاً (MUST load before any component)
import './index.css';
import './styles/animations.css';
import './styles/design-system.css';
import './styles/guest-unified.css';

// 2. ✅ React الأساسيات
import React from 'react';
import ReactDOM from 'react-dom/client';

// 3. ✅ i18n config (يُحمّل side effects ويأخذ instance)
import i18n from './i18n'; // This loads i18n.init() AND exports the instance

// 4. ✅ الـ Providers (من الأقل اعتمادية للأكثر)
import { I18nProvider } from './context/I18nContext'; // Custom I18nProvider (نظيف - لا dependencies)
import { I18nextProvider } from 'react-i18next'; // react-i18next Provider

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