import { createReadStream, existsSync, statSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

const host = '127.0.0.1'
const port = Number.parseInt(process.env.PORT ?? '4173', 10)
const distDir = join(process.cwd(), 'dist')

if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
  console.error('dist/ is missing. Run `pnpm build` before `pnpm test:smoke`.')
  process.exit(1)
}

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
  ['.xml', 'application/xml; charset=utf-8'],
])

function resolvePath(urlPath) {
  const cleanPath = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
  const candidate = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^[/\\]+/, '')
  return join(distDir, candidate)
}

function shouldServeIndex(urlPath) {
  if (urlPath === '/') return true
  return !extname(urlPath)
}

const server = createServer(async (request, response) => {
  const requestPath = request.url ?? '/'
  let filePath = resolvePath(requestPath)

  try {
    const currentStat = await stat(filePath)
    if (currentStat.isDirectory()) {
      filePath = join(filePath, 'index.html')
    }
  } catch {
    if (shouldServeIndex(requestPath)) {
      filePath = join(distDir, 'index.html')
    } else {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not found')
      return
    }
  }

  try {
    const currentStat = await stat(filePath)
    if (!currentStat.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not found')
      return
    }

    const extension = extname(filePath)
    const mimeType = mimeTypes.get(extension) ?? 'application/octet-stream'

    response.writeHead(200, {
      'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      'Content-Type': mimeType,
    })

    createReadStream(filePath).pipe(response)
  } catch (error) {
    const fallback = await readFile(join(distDir, 'index.html'), 'utf8').catch(() => null)
    if (fallback && shouldServeIndex(requestPath)) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end(fallback)
      return
    }

    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end(error instanceof Error ? error.message : 'Server error')
  }
})

server.listen(port, host, () => {
  console.log(`Serving dist/ at http://${host}:${port}`)
})
