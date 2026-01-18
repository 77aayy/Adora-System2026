/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        screens: {
            'xs': '475px',    // Extra small phones
            'sm': '640px',    // Small phones
            'md': '768px',    // Tablets (portrait)
            'lg': '1024px',   // Tablets (landscape) / Small laptops
            'xl': '1280px',   // Desktop
            '2xl': '1536px',  // Large desktop
            '3xl': '1920px',  // Full HD / TV
            '4xl': '2560px',  // 2K / Large TV
            '5xl': '3840px',  // 4K / Ultra HD TV
        },
        extend: {
            colors: {
                // Adora Primary Palette - Lighter & More Vibrant
                primary: {
                    50: '#f0fdfa',
                    100: '#ccfbf1',
                    200: '#99f6e4',
                    300: '#5eead4',
                    400: '#2dd4bf',
                    500: '#14b8a6',
                    600: '#0d9488',
                    700: '#0f766e',
                    800: '#115e59',
                    900: '#134e4a',
                    950: '#042f2e',
                },
                // Override default Tailwind teal with lighter, more vibrant colors
                teal: {
                    50: '#f0fdfa',
                    100: '#ccfbf1',
                    200: '#99f6e4',
                    300: '#5eead4',
                    400: '#2dd4bf',
                    500: '#14b8a6', // Lighter than default - main button color
                    600: '#0d9488', // Hover state
                    700: '#0f766e',
                    800: '#115e59',
                    900: '#134e4a',
                    950: '#042f2e',
                },
                // Dark Slate Background
                slate: {
                    850: '#1a1f2e',
                    900: '#0f172a',
                    950: '#020617',
                },
                // Glass Effect Colors
                glass: {
                    white: 'rgba(255, 255, 255, 0.1)',
                    border: 'rgba(255, 255, 255, 0.2)',
                    dark: 'rgba(0, 0, 0, 0.3)',
                },
                // Status Colors
                status: {
                    pending: '#eab308',    // Yellow
                    confirmed: '#3b82f6',  // Blue
                    progress: '#8b5cf6',   // Purple
                    completed: '#22c55e',  // Green
                    maintenance: '#f97316', // Orange
                    cancelled: '#ef4444',  // Red
                },
            },
            fontFamily: {
                sans: ['Inter', 'Tajawal', 'Cairo', 'system-ui', 'sans-serif'],
                arabic: ['Tajawal', 'Cairo', 'Arial', 'sans-serif'],
                cairo: ['Cairo', 'Tajawal', 'Arial', 'sans-serif'],
            },
            backdropBlur: {
                xs: '2px',
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'pulse-soft': 'pulseSoft 2s infinite',
                'shimmer': 'shimmer 2s infinite',
                'bounce-in': 'bounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                'scale-in': 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                // ✅ Premium pulse animations for StatCards
                'pulse-slow': 'pulseSlow 3s ease-in-out infinite',
                'pulse-subtle': 'pulseSubtle 2.5s ease-in-out infinite',
                'pulse-fast': 'pulseFast 1s ease-in-out infinite',
                'heartbeat': 'heartbeat 1.2s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' },
                },
                // ✅ Premium heartbeat animations
                pulseSlow: {
                    '0%, 100%': { boxShadow: '0 0 0 0 rgba(20, 184, 166, 0.4)' },
                    '50%': { boxShadow: '0 0 0 8px rgba(20, 184, 166, 0)' },
                },
                pulseSubtle: {
                    '0%, 100%': { transform: 'scale(1)', opacity: '1' },
                    '50%': { transform: 'scale(1.01)', opacity: '0.95' },
                },
                pulseFast: {
                    '0%, 100%': { boxShadow: '0 0 0 0 rgba(249, 115, 22, 0.5)' },
                    '50%': { boxShadow: '0 0 0 6px rgba(249, 115, 22, 0)' },
                },
                heartbeat: {
                    '0%, 100%': { transform: 'scale(1)' },
                    '14%': { transform: 'scale(1.02)' },
                    '28%': { transform: 'scale(1)' },
                    '42%': { transform: 'scale(1.02)' },
                    '70%': { transform: 'scale(1)' },
                },
            },
        },
    },
    plugins: [],
}
