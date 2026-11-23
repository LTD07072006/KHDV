import react from '@vitejs/plugin-react'
import { defineConfig, type ProxyOptions } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { Agent, type ClientRequest, type IncomingMessage } from 'node:http'

const backend = process.env.KHDV_BACKEND_URL ?? 'http://127.0.0.1:8000'
const activeUploads = new WeakMap<IncomingMessage, ClientRequest>()
const apiProxy: ProxyOptions = {
  target: backend,
  changeOrigin: true,
  agent: backend.startsWith('http:') ? new Agent({ keepAlive: true }) : undefined,
  configure(proxy) {
    proxy.on('proxyReq', (upstream, request) => activeUploads.set(request, upstream))
    proxy.on('proxyRes', (response, request) => {
      const upstream = activeUploads.get(request)
      if (response.statusCode !== 413 || !upstream || request.readableEnded) return

      // The API may reject Content-Length without reading the body. Drain the
      // browser upload locally so it can receive the authoritative status.
      request.unpipe(upstream)
      request.resume()
      response.once('end', () => upstream.destroy())
    })
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: {
    proxy: {
      '/api': apiProxy,
      '/health': { target: backend, changeOrigin: true },
    },
  },
})
