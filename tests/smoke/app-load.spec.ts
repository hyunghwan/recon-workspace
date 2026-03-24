import { existsSync, readdirSync, statSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

import { createSampleSnapshot } from '../../src/data'

const evidenceDir = '.sisyphus/evidence'
const localStorageKey = 'recon-workspace-state-v2'
const sampleSnapshot = createSampleSnapshot()
const sampleWorkspace = sampleSnapshot.workspaces[0]
const samplePeriod = sampleWorkspace.periods[0]
const workspaceBasePath = `/app/${sampleWorkspace.workspace.id}/${samplePeriod.period.id}`
const importsPath = `${workspaceBasePath}/imports`
const queuePath = `${workspaceBasePath}/queue`
const followUpPath = `${workspaceBasePath}/follow-up`
const generatedBlogSlug =
  readdirSync('dist/blog').find(
    (entry) => statSync(`dist/blog/${entry}`).isDirectory() && existsSync(`dist/blog/${entry}/index.html`),
  ) ?? ''
const blogPath = generatedBlogSlug ? `/blog/${generatedBlogSlug}/` : '/blog/'

test.beforeEach(async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true })
  await page.addInitScript(
    ([key, snapshot]) => {
      window.localStorage.setItem(key, JSON.stringify(snapshot))
    },
    [localStorageKey, sampleSnapshot] as const,
  )
})

test('loads landing page and shows primary heading', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Know what still needs support before month-end close.',
  )
})

test('serves nested workspace routes, customer-facing copy, and generated blog output', async ({ page }) => {
  const task4Lines: string[] = []
  const task5Lines: string[] = []
  const task6Lines: string[] = []
  const task8Lines: string[] = []

  await page.goto(importsPath)
  const sidebar = page.locator('aside')
  await expect(sidebar.getByText('Client', { exact: true }).first()).toBeVisible()
  await expect(sidebar.getByText('Month', { exact: true }).first()).toBeVisible()
  await expect(sidebar.getByText('Workflow', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Bring in this month’s files')

  const sidebarText = await page.locator('aside').innerText()
  const clientBox = await sidebar.getByText('Client', { exact: true }).first().boundingBox()
  const monthBox = await sidebar.getByText('Month', { exact: true }).first().boundingBox()
  const workflowBox = await sidebar.getByText('Workflow', { exact: true }).first().boundingBox()
  expect(clientBox?.y ?? 0).toBeLessThan(monthBox?.y ?? 0)
  expect(monthBox?.y ?? 0).toBeLessThan(workflowBox?.y ?? 0)

  for (const bannedPhrase of [
    'Cloud sync available',
    'Demo workspace active',
    'Marketing site',
    'Load sample',
    'This month at a glance',
  ]) {
    expect(sidebarText).not.toContain(bannedPhrase)
  }

  await page.screenshot({ path: `${evidenceDir}/task-4-workspace-shell.png`, fullPage: true })
  task4Lines.push(`Direct nested route loaded: ${importsPath}`)
  task4Lines.push('Visible order: Client -> Month -> Workflow')
  task4Lines.push(`Current client: ${sampleWorkspace.workspace.name}`)
  task4Lines.push(`Current month: ${samplePeriod.period.monthKey}`)

  await page.getByRole('button', { name: 'Open example client' }).click()
  const providerMessage = await page.locator('header').innerText()
  expect(providerMessage).toContain('Example client opened')
  await page.screenshot({ path: `${evidenceDir}/task-6-provider-messaging.png`, fullPage: true })
  task6Lines.push('Customer-facing message after loading example client:')
  task6Lines.push(providerMessage)

  await page.goto(importsPath)
  task5Lines.push(`Files page heading: ${await page.getByRole('heading', { level: 1 }).innerText()}`)

  await page.goto(queuePath)
  await expect(page.getByRole('heading', { level: 2, name: 'Review' })).toBeVisible()
  task5Lines.push(`Review page subheading: ${await page.getByText(sampleWorkspace.workspace.name, { exact: false }).first().innerText()}`)

  await page.goto(followUpPath)
  await expect(page.getByRole('heading', { level: 2 })).toContainText(`Open items ready to send for ${sampleWorkspace.workspace.name}`)
  await page.screenshot({ path: `${evidenceDir}/task-5-copy-alignment.png`, fullPage: true })
  task5Lines.push(`Follow-up page heading: ${await page.getByRole('heading', { level: 2 }).innerText()}`)

  await page.goto(blogPath)
  await expect(page.locator('main')).toContainText('Recon Workspace')

  for (const requiredPath of ['dist/index.html', 'dist/sitemap.xml', 'dist/rss.xml', 'dist/robots.txt']) {
    expect(existsSync(requiredPath)).toBe(true)
    task8Lines.push(`Verified artifact: ${requiredPath}`)
  }
  task8Lines.push(`Verified direct route: ${importsPath}`)
  task8Lines.push(`Verified direct route: ${queuePath}`)
  task8Lines.push(`Verified direct route: ${followUpPath}`)
  task8Lines.push(`Verified blog path: ${blogPath}`)
  task8Lines.push('Canonical origin is expected to be https://your-firebase-project-id.web.app in generated metadata.')

  await page.goto(queuePath)
  await page.screenshot({ path: `${evidenceDir}/task-8-hosting-smoke.png`, fullPage: true })

  await Promise.all([
    writeFile(`${evidenceDir}/task-4-workspace-shell.txt`, task4Lines.join('\n')),
    writeFile(`${evidenceDir}/task-5-copy-alignment.txt`, task5Lines.join('\n')),
    writeFile(`${evidenceDir}/task-6-provider-messaging.txt`, task6Lines.join('\n')),
    writeFile(`${evidenceDir}/task-8-hosting-smoke.txt`, task8Lines.join('\n')),
  ])
})
