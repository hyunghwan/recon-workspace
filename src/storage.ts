import type { ReconSnapshot } from './types'

const KEY = 'recon-workspace-state-v2'

export function loadSnapshot(): ReconSnapshot | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as ReconSnapshot
    if (!parsed || !Array.isArray(parsed.workspaces)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveSnapshot(snapshot: ReconSnapshot) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(snapshot))
  } catch {
    // ignore storage errors for local-first mode
  }
}
