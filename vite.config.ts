import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath, URL } from 'url';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        // FIX: Removed redundant definition. Only process.env.API_KEY should be used.
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      },
      resolve: {
        alias: {
          '@': fileURLToPath(new URL('./', import.meta.url)),
        },
      },
    };
});