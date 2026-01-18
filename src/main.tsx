// main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './context/I18nContext'; 
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n'; // تأكد إن ده ملف الإعدادات الأصلي (i18n.ts/js)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    </I18nProvider>
  </React.StrictMode>
);