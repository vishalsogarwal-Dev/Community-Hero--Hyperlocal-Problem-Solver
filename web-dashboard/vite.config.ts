import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Civic Assistant agent now lives in ./agent (Python/FastAPI).
      // Browser only ever sees this local path; the real Gemini call +
      // keys stay entirely inside the Python process on port 8000.
      '/api/gemini/agent': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gemini\/agent/, '/agent'),
      },
    },
  },
})
