import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Makes /img/tree.jpg etc. accessible during dev from the parent folder
  server: {
    fs: { allow: ['..'] }
  }
})
