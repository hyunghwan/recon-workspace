import fs from 'node:fs/promises'
import path from 'node:path'

import {
  CANONICAL_SITE_ORIGIN,
  distDir,
  getSiteOrigin,
  loadPosts,
  renderBlogIndex,
  renderPostPage,
  renderRobots,
  renderRssFeed,
  renderSitemap,
} from './blog-lib.mjs'

async function main() {
  const isReleaseBuild =
    process.env.npm_lifecycle_event === 'build' || process.env.CI === 'true' || process.env.FIREBASE_DEPLOY === 'true'
  const siteOrigin = getSiteOrigin({ strict: isReleaseBuild, enforceCanonical: isReleaseBuild })
  const posts = await loadPosts()
  const blogDir = path.join(distDir, 'blog')

  await fs.mkdir(blogDir, { recursive: true })
  await fs.writeFile(path.join(blogDir, 'index.html'), renderBlogIndex(posts, siteOrigin))

  for (const post of posts) {
    const postDir = path.join(blogDir, post.slug)
    await fs.mkdir(postDir, { recursive: true })
    await fs.writeFile(path.join(postDir, 'index.html'), renderPostPage(post, posts, siteOrigin))
  }

  await fs.writeFile(path.join(distDir, 'sitemap.xml'), renderSitemap(posts, siteOrigin))
  await fs.writeFile(path.join(distDir, 'rss.xml'), renderRssFeed(posts, siteOrigin))
  await fs.writeFile(path.join(distDir, 'robots.txt'), renderRobots(siteOrigin))

  const releaseNote = isReleaseBuild ? ` (canonical origin: ${CANONICAL_SITE_ORIGIN})` : ''
  console.log(`Rendered ${posts.length} blog article(s) into dist/blog.${releaseNote}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
