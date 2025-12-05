import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    runes: false,
    generate: "dom",
    compatibility: { componentApi: 4 }
  }
};
