import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward all requests starting with /api to FastAPI
      '/api': {
        target: 'http://localhost:8000', // Change this if FastAPI is on a different port
        changeOrigin: true,
      }
    }
  }
})