import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: './',
  server: {
    port: 5177, // 设置插件开发服务器端口（避免与主程序 5173 冲突）
    strictPort: true,
    open: false
  }
})
