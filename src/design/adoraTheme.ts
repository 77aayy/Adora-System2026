/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * ADORA PREMIUM DESIGN SYSTEM
 * High-end SaaS Design Tokens
 * Adora Hotel Management System V3
 */

// 🎨 ADORA BRAND IDENTITY TOKENS
export const ADORA_THEME = {
  colors: {
    primary: '#20B2AA', // The Turquoise DNA
    surface: '#FFFFFF',
    background: '#F8FAFC',
    border: '#E2E8F0',
    text: '#1E293B',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  shadows: {
    premium: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },
  zIndex: {
    header: 100,
    navigation: 200,
    dropdown: 1000,
    modal: 2000,
  }
};

// 🛠️ LAYOUT RULES:
// 1. Every icon must have a minimum gap of 12px.
// 2. Dropdowns must use absolute positioning with a higher Z-index than the navigation.
// 3. Use 'flex-wrap: nowrap' with 'overflow-x: auto' for the navigation tier to prevent squashing icons.
