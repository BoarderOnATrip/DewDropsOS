import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { runtimeBridgePlugin } from './src/lib/runtimeBridge'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    runtimeBridgePlugin(),
  ],
})
