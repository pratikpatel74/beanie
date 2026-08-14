import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split socket.io-client into its own chunk so the game code and
        // socket library are cached independently between deploys.
        manualChunks: (id) => {
          if (id.includes('socket.io-client')) return 'socketio';
        },
      },
    },
  },
})
