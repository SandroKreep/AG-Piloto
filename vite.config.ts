import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: (id) => id.includes('/api/')
    }
  },
  server: {
    watch: {
      ignored: ['**/api/**']
    }
  }
})
