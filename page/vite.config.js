import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import federation from '@originjs/vite-plugin-federation';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read plugin config
const pluginConfigPath = resolve(__dirname, 'plugin.config.js');
let pluginConfig = {};
try {
  const configContent = readFileSync(pluginConfigPath, 'utf-8');
  const match = configContent.match(/export default\s*(\{[\s\S]*\})/);
  if (match) {
    pluginConfig = eval('(' + match[1] + ')');
  }
} catch (e) {
  console.warn('Could not read plugin.config.js:', e.message);
}

export default defineConfig({
  plugins: [
    vue(),
    federation({
      name: 'mos-file-browser',
      filename: 'remoteEntry.js',
      exposes: {
        './Plugin': './src/Plugin.vue',
      },
      shared: ['vue'],
    }),
    {
      name: 'generate-manifest',
      writeBundle() {
        const manifest = {
          name: pluginConfig.name || 'mos-file-browser',
          displayName: pluginConfig.displayName || 'MOS FileBrowser',
          description: pluginConfig.description || 'File browser for MOS',
          version: process.env.npm_package_version || '1.0.0',
          icon: pluginConfig.icon || 'mdi-folder-open',
          author: pluginConfig.author || 'RiDDiX',
          homepage: pluginConfig.homepage || '',
          remoteEntry: 'remoteEntry.js',
          exposedModule: './Plugin',
        };
        
        const fs = require('fs');
        const path = require('path');
        fs.writeFileSync(
          path.resolve(__dirname, 'dist', 'manifest.json'),
          JSON.stringify(manifest, null, 2)
        );
      },
    },
  ],
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
  },
});
