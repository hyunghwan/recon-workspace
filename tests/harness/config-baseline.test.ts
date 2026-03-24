import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readJson(fileName: string): Record<string, unknown> {
  const filePath = resolve(process.cwd(), fileName)
  return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>
}

describe('verification harness baseline', () => {
  it('defines required test scripts', () => {
    const packageJson = readJson('package.json')
    const scripts = (packageJson.scripts as Record<string, string> | undefined) ?? {}

    expect(scripts.test).toBeTypeOf('string')
    expect(scripts['test:firebase']).toBeTypeOf('string')
    expect(scripts['test:smoke']).toBeTypeOf('string')
  })

  it('declares firestore and hosting emulators', () => {
    const firebaseJson = readJson('firebase.json')
    const emulators = (firebaseJson.emulators as Record<string, unknown> | undefined) ?? {}

    expect(emulators.firestore).toBeTruthy()
    expect(emulators.hosting).toBeTruthy()
  })
})
