import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { marked } from 'marked'
import YAML from 'yaml'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))

export const repoRoot = path.resolve(scriptDir, '..')
export const contentDir = path.join(repoRoot, 'content', 'blog')
export const publicDir = path.join(repoRoot, 'public')
export const distDir = path.join(repoRoot, 'dist')

export const BRAND_NAME = 'Recon Workspace'
export const BRAND_DESCRIPTION = 'Reconciliation workspace for bookkeepers and small finance teams'
export const BLOG_TITLE = `${BRAND_NAME} Blog`
export const BLOG_DESCRIPTION =
  'Practical reconciliation guides for bookkeepers, month-end close teams, and operators who need a cleaner workflow around missing support and unresolved items.'
export const DEFAULT_SITE_ORIGIN = 'http://localhost:4173'
export const BLOG_STYLESHEET_PATH = '/blog/blog.css'
export const CTA = {
  title: 'See the workflow in context',
  body: 'Open the sample workspace to review a realistic month-end flow built around unresolved items, supporting documents, and clean follow-up.',
  href: '/app',
  label: 'Open the sample workspace',
}

marked.use({
  gfm: true,
  breaks: false,
})

export function getSiteOrigin({ strict = false } = {}) {
  const raw = resolveSiteOriginEnv()

  if (!raw) {
    if (strict) {
      throw new Error('SITE_ORIGIN is required for this build environment.')
    }
    return DEFAULT_SITE_ORIGIN
  }

  let parsed
  try {
    parsed = new URL(raw)
  } catch (error) {
    throw new Error(`Invalid SITE_ORIGIN: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('SITE_ORIGIN must use http or https.')
  }

  return parsed.origin
}

function resolveSiteOriginEnv() {
  const direct = process.env.SITE_ORIGIN?.trim()
  if (direct) return direct

  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) {
    return vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`
  }

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercelProductionUrl) {
    return vercelProductionUrl.startsWith('http') ? vercelProductionUrl : `https://${vercelProductionUrl}`
  }

  return ''
}

export async function loadPosts({ includeDrafts = false } = {}) {
  const entries = await fs.readdir(contentDir, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('_'))
    .map((entry) => path.join(contentDir, entry.name))

  const posts = []
  const slugMap = new Map()

  for (const filePath of files) {
    const post = await loadPost(filePath)
    if (slugMap.has(post.slug)) {
      throw new Error(`Duplicate blog slug "${post.slug}" in ${path.basename(filePath)} and ${slugMap.get(post.slug)}.`)
    }
    slugMap.set(post.slug, path.basename(filePath))
    posts.push(post)
  }

  posts.sort((left, right) => {
    return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
  })

  return includeDrafts ? posts : posts.filter((post) => !post.draft)
}

async function loadPost(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  const { frontmatter, body } = parseFrontmatter(raw, filePath)
  const post = validateFrontmatter(frontmatter, filePath)
  const wordCount = countWords(body)
  const internalLinkCount = countInternalLinks(body)
  const bodyH1Count = countHeadingLevel(body, 1)

  if (bodyH1Count > 0) {
    throw new Error(`${relativeRepoPath(filePath)} must not include an H1 in the Markdown body. The page template renders the only H1.`)
  }

  if (wordCount < 1200) {
    throw new Error(`${relativeRepoPath(filePath)} is too short for the SEO guide. Expected at least 1200 words, found ${wordCount}.`)
  }

  if (internalLinkCount < 2) {
    throw new Error(`${relativeRepoPath(filePath)} needs at least 2 internal links. Found ${internalLinkCount}.`)
  }

  const coverPath = path.join(publicDir, post.coverImage.replace(/^\//, ''))
  await assertFileExists(coverPath, `${relativeRepoPath(filePath)} references a missing cover image`)

  return {
    ...post,
    bodyMarkdown: body.trim(),
    bodyHtml: marked.parse(body.trim()),
    wordCount,
    internalLinkCount,
    readingMinutes: Math.max(1, Math.round(wordCount / 220)),
    path: `/blog/${post.slug}/`,
    sourcePath: filePath,
  }
}

function parseFrontmatter(raw, filePath) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    throw new Error(`${relativeRepoPath(filePath)} must start with YAML frontmatter.`)
  }

  const frontmatter = YAML.parse(match[1]) ?? {}
  const body = match[2]?.trim()

  if (!body) {
    throw new Error(`${relativeRepoPath(filePath)} is missing Markdown body content.`)
  }

  return { frontmatter, body }
}

function validateFrontmatter(frontmatter, filePath) {
  const requiredStringFields = [
    'slug',
    'title',
    'description',
    'excerpt',
    'publishedAt',
    'coverImage',
    'coverImageAlt',
  ]

  for (const field of requiredStringFields) {
    if (typeof frontmatter[field] !== 'string' || frontmatter[field].trim().length === 0) {
      throw new Error(`${relativeRepoPath(filePath)} is missing required frontmatter field "${field}".`)
    }
  }

  const slug = frontmatter.slug.trim()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`${relativeRepoPath(filePath)} has an invalid slug "${slug}". Use kebab-case only.`)
  }

  const title = frontmatter.title.trim()
  if (title.length < 50 || title.length > 65) {
    throw new Error(`${relativeRepoPath(filePath)} title length must be 50-65 characters. Found ${title.length}.`)
  }

  const description = frontmatter.description.trim()
  if (description.length < 140 || description.length > 160) {
    throw new Error(`${relativeRepoPath(filePath)} description length must be 140-160 characters. Found ${description.length}.`)
  }

  const excerpt = frontmatter.excerpt.trim()
  if (excerpt.length < 90 || excerpt.length > 220) {
    throw new Error(`${relativeRepoPath(filePath)} excerpt length must be 90-220 characters. Found ${excerpt.length}.`)
  }

  const publishedAt = validateIsoDate(frontmatter.publishedAt, filePath, 'publishedAt')
  const updatedAt = frontmatter.updatedAt ? validateIsoDate(frontmatter.updatedAt, filePath, 'updatedAt') : null
  const tags = validateStringArray(frontmatter.tags, filePath, 'tags')
  const keywords = validateStringArray(frontmatter.keywords, filePath, 'keywords')
  const coverImage = frontmatter.coverImage.trim()
  const coverImageAlt = frontmatter.coverImageAlt.trim()
  const draft = frontmatter.draft === true

  if (!coverImage.startsWith('/blog/images/')) {
    throw new Error(`${relativeRepoPath(filePath)} coverImage must live under /blog/images/.`)
  }

  return {
    slug,
    title,
    description,
    excerpt,
    publishedAt,
    updatedAt,
    tags,
    keywords,
    coverImage,
    coverImageAlt,
    draft,
  }
}

function validateStringArray(value, filePath, field) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    throw new Error(`${relativeRepoPath(filePath)} frontmatter field "${field}" must be a non-empty array of strings.`)
  }

  return value.map((item) => item.trim())
}

function validateIsoDate(value, filePath, field) {
  if (typeof value !== 'string') {
    throw new Error(`${relativeRepoPath(filePath)} frontmatter field "${field}" must be a string date.`)
  }

  const trimmed = value.trim()
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${relativeRepoPath(filePath)} frontmatter field "${field}" must be a valid ISO date.`)
  }

  return trimmed
}

function countWords(markdown) {
  return markdown
    .replace(/`[^`]+`/g, ' ')
    .replace(/\[[^\]]+\]\([^)]+\)/g, ' ')
    .replace(/[#>*_\-|]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
}

function countInternalLinks(markdown) {
  return Array.from(markdown.matchAll(/\[[^\]]+\]\((\/[^)]+)\)/g)).length
}

function countHeadingLevel(markdown, level) {
  const expression = new RegExp(`^${'#'.repeat(level)}\\s+`, 'gm')
  return (markdown.match(expression) || []).length
}

async function assertFileExists(filePath, messagePrefix) {
  try {
    await fs.access(filePath)
  } catch {
    throw new Error(`${messagePrefix}: ${relativeRepoPath(filePath)}.`)
  }
}

export function renderBlogIndex(posts, siteOrigin) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    url: `${siteOrigin}/blog/`,
    isPartOf: {
      '@type': 'WebSite',
      name: BRAND_NAME,
      url: `${siteOrigin}/`,
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: posts.map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${siteOrigin}${post.path}`,
        name: post.title,
      })),
    },
  }

  const feature = posts[0]
  const articlesHtml = posts
    .map((post) => {
      const publishedLabel = formatDate(post.publishedAt)
      return `
        <article class="post-card">
          <a class="post-card__image-link" href="${post.path}">
            <img class="post-card__image" src="${post.coverImage}" alt="${escapeHtml(post.coverImageAlt)}" />
          </a>
          <div class="post-card__content">
            <p class="post-card__meta">${escapeHtml(publishedLabel)} · ${post.readingMinutes} min read</p>
            <h2 class="post-card__title"><a href="${post.path}">${escapeHtml(post.title)}</a></h2>
            <p class="post-card__description">${escapeHtml(post.excerpt)}</p>
            <div class="tag-row">${post.tags.map(renderTag).join('')}</div>
            <a class="text-link" href="${post.path}">Read the guide</a>
          </div>
        </article>
      `
    })
    .join('')

  const content = `
    ${renderSiteHeader('blog')}
    <main class="blog-page">
      <section class="hero hero--wide">
        <div class="hero__content">
          <p class="eyebrow">Organic acquisition for reconciliation workflows</p>
          <h1 class="hero__title">Practical guides for bookkeepers who need cleaner month-end prep.</h1>
          <p class="hero__summary">
            The Recon Workspace blog is built to answer the operational questions people search before they are ready to buy software:
            missing supporting docs, reconciliation cleanup, and unresolved transaction follow-up.
          </p>
          <div class="hero__actions">
            <a class="button button--primary" href="${CTA.href}">${CTA.label}</a>
            <a class="button button--secondary" href="/">Back to the product site</a>
          </div>
        </div>
        ${
          feature
            ? `
              <a class="feature-card" href="${feature.path}">
                <img class="feature-card__image" src="${feature.coverImage}" alt="${escapeHtml(feature.coverImageAlt)}" />
                <div class="feature-card__body">
                  <p class="feature-card__label">Featured guide</p>
                  <h2>${escapeHtml(feature.title)}</h2>
                  <p>${escapeHtml(feature.excerpt)}</p>
                </div>
              </a>
            `
            : ''
        }
      </section>

      <section class="section-shell">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Latest articles</p>
            <h2 class="section-title">Guides that help operators trust the workflow before the close gets messy.</h2>
          </div>
          <p class="section-copy">
            Every article points back to the same product promise: the work gets easier when the files, review state, and follow-up live in one place.
          </p>
        </div>
        <div class="post-grid">
          ${articlesHtml}
        </div>
      </section>

      ${renderCtaBand()}
    </main>
    ${renderSiteFooter()}
  `

  return renderDocument({
    pageTitle: BLOG_TITLE,
    metaDescription: BLOG_DESCRIPTION,
    canonicalPath: '/blog/',
    siteOrigin,
    socialImage: feature?.coverImage ?? '/recon-favicon.png',
    structuredData,
    content,
    openGraphType: 'website',
  })
}

export function renderPostPage(post, posts, siteOrigin) {
  const relatedPosts = pickRelatedPosts(post, posts)
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    image: [`${siteOrigin}${post.coverImage}`],
    datePublished: new Date(post.publishedAt).toISOString(),
    ...(post.updatedAt ? { dateModified: new Date(post.updatedAt).toISOString() } : {}),
    author: {
      '@type': 'Organization',
      name: BRAND_NAME,
    },
    publisher: {
      '@type': 'Organization',
      name: BRAND_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${siteOrigin}/recon-favicon.png`,
      },
    },
    mainEntityOfPage: `${siteOrigin}${post.path}`,
    keywords: post.keywords.join(', '),
  }

  const relatedHtml = relatedPosts.length
    ? `
        <section class="section-shell section-shell--compact">
          <div class="section-heading section-heading--stacked">
            <div>
              <p class="eyebrow">Related reading</p>
              <h2 class="section-title">Keep building the workflow context around the close.</h2>
            </div>
          </div>
          <div class="related-grid">
            ${relatedPosts
              .map(
                (related) => `
                  <article class="related-card">
                    <img class="related-card__image" src="${related.coverImage}" alt="${escapeHtml(related.coverImageAlt)}" />
                    <div class="related-card__body">
                      <p class="post-card__meta">${escapeHtml(formatDate(related.publishedAt))}</p>
                      <h3><a href="${related.path}">${escapeHtml(related.title)}</a></h3>
                      <p>${escapeHtml(related.excerpt)}</p>
                    </div>
                  </article>
                `,
              )
              .join('')}
          </div>
        </section>
      `
    : ''

  const content = `
    ${renderSiteHeader('blog')}
    <main class="blog-page">
      <article class="article-shell">
        <div class="article-hero">
          <p class="eyebrow">Recon Workspace blog</p>
          <h1 class="article-title">${escapeHtml(post.title)}</h1>
          <p class="article-summary">${escapeHtml(post.excerpt)}</p>
          <div class="article-meta">
            <span>${escapeHtml(formatDate(post.publishedAt))}</span>
            <span>${post.readingMinutes} min read</span>
            <span>${post.wordCount} words</span>
          </div>
          <div class="tag-row">${post.tags.map(renderTag).join('')}</div>
        </div>

        <img class="article-cover" src="${post.coverImage}" alt="${escapeHtml(post.coverImageAlt)}" />

        <div class="article-layout">
          <aside class="article-sidebar">
            <div class="sidebar-card">
              <p class="sidebar-card__eyebrow">Why this matters</p>
              <p class="sidebar-card__copy">
                This guide is part of a broader content system designed to bring bookkeepers and finance operators into Recon Workspace organically.
              </p>
              <a class="text-link" href="${CTA.href}">${CTA.label}</a>
            </div>
            <div class="sidebar-card">
              <p class="sidebar-card__eyebrow">Keywords</p>
              <ul class="sidebar-list">
                ${post.keywords.map((keyword) => `<li>${escapeHtml(keyword)}</li>`).join('')}
              </ul>
            </div>
          </aside>

          <div class="article-content">
            <div class="prose">
              ${post.bodyHtml}
            </div>
            ${renderInlineCta()}
          </div>
        </div>
      </article>

      ${relatedHtml}
    </main>
    ${renderSiteFooter()}
  `

  return renderDocument({
    pageTitle: `${post.title} | ${BRAND_NAME}`,
    metaDescription: post.description,
    canonicalPath: post.path,
    siteOrigin,
    socialImage: post.coverImage,
    structuredData,
    content,
    openGraphType: 'article',
  })
}

export function renderRssFeed(posts, siteOrigin) {
  const items = posts
    .map((post) => {
      return `
        <item>
          <title>${escapeXml(post.title)}</title>
          <link>${escapeXml(`${siteOrigin}${post.path}`)}</link>
          <guid>${escapeXml(`${siteOrigin}${post.path}`)}</guid>
          <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
          <description><![CDATA[${post.excerpt}]]></description>
        </item>
      `
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(BLOG_TITLE)}</title>
    <link>${escapeXml(`${siteOrigin}/blog/`)}</link>
    <description>${escapeXml(BLOG_DESCRIPTION)}</description>
    ${items}
  </channel>
</rss>
`
}

export function renderSitemap(posts, siteOrigin) {
  const entries = [
    { loc: `${siteOrigin}/`, lastmod: currentDateString() },
    { loc: `${siteOrigin}/blog/`, lastmod: currentDateString() },
    ...posts.map((post) => ({
      loc: `${siteOrigin}${post.path}`,
      lastmod: post.updatedAt ?? post.publishedAt,
    })),
  ]

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${escapeXml(new Date(entry.lastmod).toISOString())}</lastmod>
  </url>`,
  )
  .join('\n')}
</urlset>
`
}

export function renderRobots(siteOrigin) {
  return `User-agent: *
Allow: /

Sitemap: ${siteOrigin}/sitemap.xml
`
}

function renderDocument({
  pageTitle,
  metaDescription,
  canonicalPath,
  siteOrigin,
  socialImage,
  structuredData,
  content,
  openGraphType,
}) {
  const canonicalUrl = `${siteOrigin}${canonicalPath}`
  const socialUrl = `${siteOrigin}${socialImage}`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(metaDescription)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <link rel="icon" type="image/png" href="/recon-favicon.png" />
    <link rel="stylesheet" href="${BLOG_STYLESHEET_PATH}" />
    <meta property="og:site_name" content="${BRAND_NAME}" />
    <meta property="og:type" content="${openGraphType}" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(metaDescription)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(socialUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(metaDescription)}" />
    <meta name="twitter:image" content="${escapeHtml(socialUrl)}" />
    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
  </head>
  <body>
    ${content}
  </body>
</html>
`
}

function renderSiteHeader(activeSection) {
  return `
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand-lockup" href="/">
          <span class="brand-mark" aria-hidden="true">🗂️</span>
          <span>
            <span class="brand-name">${BRAND_NAME}</span>
            <span class="brand-tagline">${BRAND_DESCRIPTION}</span>
          </span>
        </a>
        <nav class="site-nav" aria-label="Primary">
          <a class="${activeSection === 'home' ? 'is-active' : ''}" href="/">Home</a>
          <a class="${activeSection === 'blog' ? 'is-active' : ''}" href="/blog/">Blog</a>
          <a class="button button--primary button--compact" href="${CTA.href}">${CTA.label}</a>
        </nav>
      </div>
    </header>
  `
}

function renderSiteFooter() {
  return `
    <footer class="site-footer">
      <div class="site-footer__inner">
        <div>
          <p class="site-footer__title">${BRAND_NAME}</p>
          <p class="site-footer__copy">${BRAND_DESCRIPTION}</p>
        </div>
        <div class="site-footer__links">
          <a href="/">Product</a>
          <a href="/blog/">Blog</a>
          <a href="${CTA.href}">${CTA.label}</a>
        </div>
      </div>
    </footer>
  `
}

function renderCtaBand() {
  return `
    <section class="section-shell section-shell--compact">
      <div class="cta-band">
        <div>
          <p class="eyebrow">Product CTA</p>
          <h2 class="section-title">${CTA.title}</h2>
          <p class="section-copy">${CTA.body}</p>
        </div>
        <div class="hero__actions">
          <a class="button button--primary" href="${CTA.href}">${CTA.label}</a>
          <a class="button button--secondary" href="/">Back to the product site</a>
        </div>
      </div>
    </section>
  `
}

function renderInlineCta() {
  return `
    <section class="inline-cta">
      <p class="eyebrow">Ready to see the workflow?</p>
      <h2>${CTA.title}</h2>
      <p>${CTA.body}</p>
      <a class="button button--primary" href="${CTA.href}">${CTA.label}</a>
    </section>
  `
}

function renderTag(tag) {
  return `<span class="tag">${escapeHtml(tag)}</span>`
}

function pickRelatedPosts(currentPost, posts) {
  return posts
    .filter((post) => post.slug !== currentPost.slug)
    .map((post) => ({
      post,
      score: scorePostRelation(currentPost, post),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 2)
    .map(({ post }) => post)
}

function scorePostRelation(left, right) {
  let score = 0
  for (const tag of right.tags) {
    if (left.tags.includes(tag)) score += 3
  }
  for (const keyword of right.keywords) {
    if (left.keywords.includes(keyword)) score += 1
  }
  return score
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(dateString))
}

function currentDateString() {
  return new Date().toISOString()
}

export function relativeRepoPath(filePath) {
  return path.relative(repoRoot, filePath) || '.'
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", '&apos;')
}
