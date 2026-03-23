import { loadPosts } from './blog-lib.mjs'

async function main() {
  const posts = await loadPosts({ includeDrafts: true })

  const publishedPosts = posts.filter((post) => !post.draft)
  console.log(`Validated ${posts.length} blog Markdown file(s); ${publishedPosts.length} will be published.`)
  for (const post of publishedPosts) {
    console.log(`- ${post.slug}: ${post.wordCount} words, ${post.internalLinkCount} internal links, ${post.readingMinutes} min read`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
