import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend proxy URL; use 'http://backend:8080' inside docker, or 'http://localhost:8080' normally
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // required for Docker to expose outside the container
    port: 5173,
    proxy: {
      '/auth': { target: backendUrl, changeOrigin: true },
      '/ems':  { target: backendUrl, changeOrigin: true },
    },
  },
})
