/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hero: {
          50: '#f9fafb',
          100: '#f3f4f6',
          500: '#111827',
          600: '#1f2937',
          700: '#374151',
        }
      }
    },
  },
  plugins: [],
}
