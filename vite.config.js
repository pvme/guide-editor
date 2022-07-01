import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],

  // makes it so that paths in dist/index.html are 'dist/...' instead of '/dist/...'
  // https://stackoverflow.com/questions/69744253/vite-build-always-using-static-paths
  base: '' 
})
