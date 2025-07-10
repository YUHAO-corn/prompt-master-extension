/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        magic: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        // 品牌蓝色
        'brand-blue': '#4A90E2',
        'brand-blue-dark': '#3A7BC8',
      },
      zIndex: {
        'base': 'var(--z-base)',
        'raised': 'var(--z-raised)',
        'dropdown': 'var(--z-dropdown)',
        'sticky': 'var(--z-sticky)',
        'drawer': 'var(--z-drawer)',
        'overlay': 'var(--z-overlay)',
        'modal': 'var(--z-modal)',
        'notification': 'var(--z-notification)',
        'highest': 'var(--z-highest)',
        'drawer-backdrop': 'var(--z-drawer-backdrop)',
        'drawer-container': 'var(--z-drawer-container)',
        'modal-backdrop': 'var(--z-modal-backdrop)',
        'modal-container': 'var(--z-modal-container)',
        'auth-backdrop': 'var(--z-auth-backdrop)',
        'auth-container': 'var(--z-auth-container)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'shimmer-fast': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'shimmer-interval': {
          '0%': { transform: 'translateX(-100%)', opacity: 0 },
          '10%': { opacity: 1 },
          '40%': { transform: 'translateX(100%)', opacity: 1 },
          '41%': { opacity: 0 },
          '100%': { opacity: 0, transform: 'translateX(-100%)' },
        },
        glow: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.6 },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        bounce: {
          '0%, 100%': { transform: 'translateY(-25%)' },
          '50%': { transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { 
            opacity: '0',
            transform: 'translateY(20px) scale(0.95)',
            filter: 'brightness(0.3)'
          },
          '50%': {
            opacity: '0.5',
            transform: 'translateY(10px) scale(0.97)',
            filter: 'brightness(0.6)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0) scale(1)',
            filter: 'brightness(1)'
          }
        },
        'slide-in-down': {
          '0%': { 
            opacity: '0',
            transform: 'translateY(-10px)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)'
          }
        },
        'slide-in-up': {
          '0%': { 
            opacity: '0',
            transform: 'translateY(10px)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)'
          }
        },
        'magic-reveal': {
          '0%': { 
            opacity: '0',
            filter: 'brightness(0.1) blur(4px)'
          },
          '50%': {
            opacity: '0.5',
            filter: 'brightness(0.5) blur(2px)'
          },
          '100%': {
            opacity: '1',
            filter: 'brightness(1) blur(0)'
          }
        },
        'magic-reveal-fast': {
          '0%': { 
            opacity: '0',
            filter: 'brightness(0.5) blur(2px)'
          },
          '100%': {
            opacity: '1',
            filter: 'brightness(1) blur(0)'
          }
        },
        pulse: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 }
        }
      },
      animation: {
        shimmer: 'shimmer 8s linear infinite',
        'shimmer-fast': 'shimmer-fast 1.5s ease-in-out infinite',
        'shimmer-slow': 'shimmer-fast 4.5s ease-in-out infinite',
        'shimmer-interval': 'shimmer-interval 5.5s ease-in-out infinite',
        glow: 'glow 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        bounce: 'bounce 1s ease-in-out infinite',
        'slide-in': 'slide-in 0.6s ease-out forwards',
        'slide-in-down': 'slide-in-down 0.12s ease-out forwards',
        'slide-in-up': 'slide-in-up 0.12s ease-out forwards',
        'magic-reveal': 'magic-reveal 1.2s ease-out forwards',
        'magic-reveal-fast': 'magic-reveal-fast 0.3s ease-out forwards',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'scroll': 'linear-gradient(to right, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar')({ nocompatible: true }),
  ],
};