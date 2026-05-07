import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Unified FastAPI backend URL. It serves EMS APIs and chatbot routes under /api.
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // required for Docker to expose outside the container
    port: 5173,
    proxy: {
      '/api': { target: backendUrl, changeOrigin: true },
    },
  },
})
