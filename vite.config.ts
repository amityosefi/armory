import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-ignore
import tailwindcss from '@tailwindcss/vite'
// @ts-ignore
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/armory/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'), // <--- this line is important
      'xlsx': '@e965/xlsx',
    },
  },
})
