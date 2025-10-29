import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    https: false,
    proxy: {
      // Proxy API requests to the backend
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Proxy WebSocket connections
      '/socket.io': {
        target: 'ws://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  }
})
