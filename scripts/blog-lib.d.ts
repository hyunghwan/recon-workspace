export interface BlogPost {
  slug: string
  title: string
  description: string
  excerpt: string
  publishedAt: string
  updatedAt: string | null
  tags: string[]
  keywords: string[]
  coverImage: string
  coverImageAlt: string
  draft: boolean
  bodyMarkdown: string
  bodyHtml: string
  wordCount: number
  internalLinkCount: number
  readingMinutes: number
  path: string
  sourcePath: string
}

export declare const repoRoot: string
export declare const contentDir: string
export declare const publicDir: string
export declare const distDir: string
export declare const BRAND_NAME: string
export declare const BRAND_DESCRIPTION: string
export declare const BLOG_TITLE: string
export declare const BLOG_DESCRIPTION: string
export declare const DEFAULT_SITE_ORIGIN: string
export declare const BLOG_STYLESHEET_PATH: string
export declare const CTA: {
  title: string
  body: string
  href: string
  label: string
}

export declare function getSiteOrigin(options?: { strict?: boolean }): string
export declare function loadPosts(options?: { includeDrafts?: boolean }): Promise<BlogPost[]>
export declare function renderBlogIndex(posts: BlogPost[], siteOrigin: string): string
export declare function renderPostPage(post: BlogPost, posts: BlogPost[], siteOrigin: string): string
export declare function renderRssFeed(posts: BlogPost[], siteOrigin: string): string
export declare function renderSitemap(posts: BlogPost[], siteOrigin: string): string
export declare function renderRobots(siteOrigin: string): string
export declare function relativeRepoPath(filePath: string): string
