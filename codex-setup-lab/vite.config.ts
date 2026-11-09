import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createBuildInfo, serializeBuildInfo } from './build-info'

const versionPaths = new Set(['/version', '/version.json'])

function getRequestPath(request: Connect.IncomingMessage): string {
  return new URL(request.url ?? '/', 'http://localhost').pathname
}

function buildInfoPlugin(): Plugin {
  return {
    name: 'codex-build-info',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!versionPaths.has(getRequestPath(request))) {
          next()
          return
        }

        response.setHeader('Cache-Control', 'no-store')
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(serializeBuildInfo(createBuildInfo({ source: 'vite-dev' })))
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!versionPaths.has(getRequestPath(request))) {
          next()
          return
        }

        response.setHeader('Cache-Control', 'no-store')
        request.url = '/version.json'
        next()
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: serializeBuildInfo(createBuildInfo()),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), buildInfoPlugin()],
})
