import fs from 'node:fs/promises'
import path from 'node:path'

import {
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
  const strictSiteOrigin = process.env.CI === 'true' || Boolean(process.env.VERCEL) || Boolean(process.env.FIREBASE_DEPLOY)
  const siteOrigin = getSiteOrigin({ strict: strictSiteOrigin })
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

  if (!process.env.SITE_ORIGIN && siteOrigin.startsWith('http://localhost')) {
    console.warn(`SITE_ORIGIN not set. Blog metadata was rendered with ${siteOrigin}. Set SITE_ORIGIN for production builds.`)
  }

  console.log(`Rendered ${posts.length} blog article(s) into dist/blog.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
