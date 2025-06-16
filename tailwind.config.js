/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Apple-inspired system colors
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Notion-inspired semantic colors
        notion: {
          'text-primary': 'rgba(55, 53, 47, 1)',
          'text-secondary': 'rgba(55, 53, 47, 0.65)',
          'text-tertiary': 'rgba(55, 53, 47, 0.4)',
          'bg-primary': 'rgba(255, 255, 255, 1)',
          'bg-secondary': 'rgba(247, 246, 243, 1)',
          'bg-tertiary': 'rgba(241, 240, 236, 1)',
          'border': 'rgba(227, 226, 224, 1)',
          'hover': 'rgba(55, 53, 47, 0.08)',
        },
        // Dark mode variants
        dark: {
          'text-primary': 'rgba(255, 255, 255, 0.9)',
          'text-secondary': 'rgba(255, 255, 255, 0.7)',
          'text-tertiary': 'rgba(255, 255, 255, 0.5)',
          'bg-primary': 'rgba(25, 25, 25, 1)',
          'bg-secondary': 'rgba(32, 32, 32, 1)',
          'bg-tertiary': 'rgba(37, 37, 37, 1)',
          'border': 'rgba(55, 55, 55, 1)',
          'hover': 'rgba(255, 255, 255, 0.05)',
        }
      },
      fontFamily: {
        'sans': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        'mono': ['SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'monospace'],
      },
      fontSize: {
        'title-large': ['2.25rem', { lineHeight: '2.5rem', fontWeight: '700', letterSpacing: '-0.02em' }],
        'title': ['1.875rem', { lineHeight: '2.25rem', fontWeight: '600', letterSpacing: '-0.025em' }],
        'title-medium': ['1.5rem', { lineHeight: '2rem', fontWeight: '600', letterSpacing: '-0.025em' }],
        'title-small': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600', letterSpacing: '-0.025em' }],
        'body-large': ['1.125rem', { lineHeight: '1.75rem', fontWeight: '400' }],
        'body': ['1rem', { lineHeight: '1.5rem', fontWeight: '400' }],
        'body-small': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],
        'caption': ['0.75rem', { lineHeight: '1rem', fontWeight: '400' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        'apple': '0.5rem',
        'apple-lg': '0.75rem',
        'apple-xl': '1rem',
      },
      boxShadow: {
        'apple': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'apple-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'apple-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'notion': '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'bounce-gentle': 'bounceGentle 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bounceGentle: {
          '0%, 20%, 53%, 80%, 100%': { transform: 'translate3d(0,0,0)' },
          '40%, 43%': { transform: 'translate3d(0, -10px, 0)' },
          '70%': { transform: 'translate3d(0, -5px, 0)' },
          '90%': { transform: 'translate3d(0, -2px, 0)' },
        },
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}