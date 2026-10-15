import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import { fileURLToPath, URL } from 'node:url'
import { playgroundSessionPlugin } from './vite.playground-session'

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/scoreboard-sport/',
  plugins: [
    vue(),
    playgroundSessionPlugin(),
    Components({
      resolvers: [AntDesignVueResolver({ importStyle: false })],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}))
