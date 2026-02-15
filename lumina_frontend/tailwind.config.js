/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lumina: {
          50: '#fffbf0',
          100: '#fff4c6',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          900: '#1e293b',
        }
      },
      fontFamily: {
        // Updated to Outfit
        sans: ['Outfit', 'sans-serif'],
      }
    },
  },
  plugins: [],
}