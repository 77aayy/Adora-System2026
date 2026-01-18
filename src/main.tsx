// main.tsx
// 1. ✅ استيراد ملف الإعدادات الأول تمااااااماً (يُحمّل side effects ويأخذ instance)
import './i18n';

// 2. ✅ React الأساسيات
import React from 'react';
import ReactDOM from 'react-dom/client';

// 3. ✅ استيراد الـ Providers
import { I18nProvider } from './context/I18nContext';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n'; // تأكد إن المسار ده صح

// 4. ✅ CSS (يمكن تحميله بعد React)
import './index.css';
import './styles/animations.css';
import './styles/design-system.css';
import './styles/guest-unified.css';

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