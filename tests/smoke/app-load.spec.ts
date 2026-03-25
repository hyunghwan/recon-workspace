import { existsSync, readdirSync, statSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

const evidenceDir = '.sisyphus/evidence'
const gatedQueuePath = '/app/workspace_fake/period_fake/queue'
const generatedBlogSlug =
  readdirSync('dist/blog').find(
    (entry) => statSync(`dist/blog/${entry}`).isDirectory() && existsSync(`dist/blog/${entry}/index.html`),
  ) ?? ''
const blogPath = generatedBlogSlug ? `/blog/${generatedBlogSlug}/` : '/blog/'

test.beforeEach(async () => {
  await mkdir(evidenceDir, { recursive: true })
})

test('loads landing page with sign-up-first messaging', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Know what still needs support before month-end close.',
  )
  await expect(page.getByRole('main').getByRole('button', { name: 'Start with Google' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Import a CSV' })).toBeVisible()
  await expect(page.getByText('Open the sample workspace')).toHaveCount(0)

  await page.screenshot({ path: `${evidenceDir}/task-4-landing-signup-first.png`, fullPage: true })
})

test('gates workspace routes behind sign-in and still serves generated blog output', async ({ page }) => {
  const gateLines: string[] = []
  const artifactLines: string[] = []

  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'Sign in to open your clients' })).toBeVisible()
  await expect(page.getByText('delete the sample data', { exact: false })).toBeVisible()
  await expect(page.getByText('Client', { exact: true })).toHaveCount(0)

  await page.goto(gatedQueuePath)
  await expect(page.getByRole('heading', { name: 'Sign in to open your clients' })).toBeVisible()
  await page.screenshot({ path: `${evidenceDir}/task-5-app-signin-gate.png`, fullPage: true })

  gateLines.push('Unauthenticated /app route shows a dedicated sign-in gate.')
  gateLines.push(`Direct nested route still gates correctly: ${gatedQueuePath}`)

  await page.goto(blogPath)
  await expect(page.locator('main')).toContainText('Recon Workspace')

  for (const requiredPath of ['dist/index.html', 'dist/sitemap.xml', 'dist/rss.xml', 'dist/robots.txt']) {
    expect(existsSync(requiredPath)).toBe(true)
    artifactLines.push(`Verified artifact: ${requiredPath}`)
  }
  artifactLines.push(`Verified blog path: ${blogPath}`)

  await Promise.all([
    writeFile(`${evidenceDir}/task-5-app-signin-gate.txt`, gateLines.join('\n')),
    writeFile(`${evidenceDir}/task-8-hosting-smoke.txt`, artifactLines.join('\n')),
  ])
})
