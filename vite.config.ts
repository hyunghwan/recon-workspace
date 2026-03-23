import tailwindcss from '@tailwindcss/vite'
import { getSiteOrigin, loadPosts, renderBlogIndex, renderPostPage } from './scripts/blog-lib.mjs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function blogDevPlugin() {
  return {
    name: 'recon-blog-dev-plugin',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          next()
          return
        }

        const requestPath = req.url?.split('?')[0] ?? '/'

        if (requestPath === '/blog' || requestPath === '/blog/') {
          const siteOrigin = req.headers.host ? `http://${req.headers.host}` : getSiteOrigin()
          const posts = await loadPosts()
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(renderBlogIndex(posts, siteOrigin))
          return
        }

        const match = requestPath.match(/^\/blog\/([a-z0-9-]+)\/?$/)
        if (!match) {
          next()
          return
        }

        const siteOrigin = req.headers.host ? `http://${req.headers.host}` : getSiteOrigin()
        const posts = await loadPosts()
        const post = posts.find((entry) => entry.slug === match[1])

        if (!post) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end('<!doctype html><html lang="en"><body><h1>Blog post not found</h1></body></html>')
          return
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(renderPostPage(post, posts, siteOrigin))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react(), blogDevPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('node_modules/firebase')) return 'firebase'
          if (id.includes('node_modules/react-router')) return 'router'
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react-vendor'
          if (id.includes('node_modules/lucide-react')) return 'icons'
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
