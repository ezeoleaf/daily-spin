import react from '@vitejs/plugin-react'
import { copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.PAGES_BASE_PATH || '/',
  plugins: [
    react(),
    {
      name: 'github-pages-fallback',
      apply: 'build',
      async writeBundle(options) {
        const directory = options.dir || 'dist'
        await copyFile(
          resolve(directory, 'index.html'),
          resolve(directory, '404.html'),
        )
      },
    },
  ],
})
