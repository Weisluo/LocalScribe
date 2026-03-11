import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // 前端开发服务器端口
    proxy: {
      // 将以 /api 开头的请求代理到后端
      '/api': {
        target: 'http://localhost:8000', // 后端服务地址（FastAPI 默认端口）
        changeOrigin: true,
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // 常用别名，方便引入
    },
  },
})