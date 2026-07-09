import { defineConfig } from 'vite';
import ruby from 'vite-plugin-ruby';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { aliases, vueOptions } from './vite.shared';
import yaml from '@rollup/plugin-yaml';

export default defineConfig({
  plugins: [ruby(), vue(vueOptions), yaml()],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        // Ensure @import 'reset' and other bare imports resolve correctly
        // regardless of whether sass or sass-embedded is used as the compiler.
        loadPaths: [
          path.resolve('./app/javascript/widget/assets/scss'),
          path.resolve('./app/javascript/dashboard/assets/scss'),
          path.resolve('./node_modules'),
        ],
      },
    },
  },
  resolve: { alias: aliases },
});
