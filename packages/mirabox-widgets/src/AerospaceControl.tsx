import React, { useState, useEffect } from 'react'
import { Rect, Text, Image as KonvaImage } from 'react-konva'
import { Key, TouchKey } from 'react-mirabox'
import { exec, execSync } from 'child_process'
import { existsSync, unlinkSync } from 'fs'
import { promisify } from 'util'
import { loadImage } from 'skia-canvas'

const execAsync = promisify(exec)

// ── Types ────────────────────────────────────────────────────────────────────

interface AppWindow {
  'app-name': string
  'window-id': number
  'window-title': string
}

// ── Aerospace CLI ────────────────────────────────────────────────────────────

function getFocusedWorkspace(): string {
  try {
    return execSync('aerospace list-workspaces --focused', { stdio: 'pipe' }).toString().trim()
  } catch { return '' }
}

async function getWorkspaceWindows(workspace: string): Promise<AppWindow[]> {
  try {
    const { stdout } = await execAsync(`aerospace list-windows --workspace ${workspace} --json`)
    return JSON.parse(stdout)
  } catch { return [] }
}

function aerospace(cmd: string) {
  console.log(`aerospace ${cmd}`)
  exec(`aerospace ${cmd}`, (err) => {
    if (err) console.error(`aerospace ${cmd}:`, err.message)
  })
}

// ── App icon extraction ──────────────────────────────────────────────────────

// Module-level cache: app name → skia-canvas Image (null = failed/loading)
const iconCache = new Map<string, any>()

async function loadAppIcon(appName: string): Promise<any | null> {
  if (iconCache.has(appName)) return iconCache.get(appName) ?? null
  // Sentinel to prevent concurrent fetches for the same app
  iconCache.set(appName, null)

  try {
    // 1. Resolve the app bundle path via Spotlight (works for any installed app)
    const appPath = execSync(
      `osascript -e 'POSIX path of (path to application "${appName.replace(/"/g, '\\"')}")'`,
      { stdio: 'pipe', timeout: 3000 }
    ).toString().trim()

    // 2. Read the icon file name from the bundle's Info.plist
    let iconName: string
    try {
      iconName = execSync(
        `/usr/libexec/PlistBuddy -c "Print CFBundleIconFile" "${appPath}Contents/Info.plist"`,
        { stdio: 'pipe' }
      ).toString().trim()
    } catch {
      // Some newer apps use CFBundleIconName instead
      iconName = execSync(
        `/usr/libexec/PlistBuddy -c "Print CFBundleIconName" "${appPath}Contents/Info.plist"`,
        { stdio: 'pipe' }
      ).toString().trim()
    }
    if (!iconName.endsWith('.icns')) iconName += '.icns'

    const icnsPath = `${appPath}Contents/Resources/${iconName}`
    if (!existsSync(icnsPath)) return null

    // 3. Convert .icns → PNG at 64×64 using sips (built-in macOS)
    const tmpPath = `/tmp/mirabox-icon-${appName.replace(/[^a-z0-9]/gi, '_')}.png`
    execSync(`sips -s format png -z 64 64 "${icnsPath}" --out "${tmpPath}"`, { stdio: 'pipe' })

    const img = await loadImage(tmpPath)
    try { unlinkSync(tmpPath) } catch {}

    iconCache.set(appName, img)
    return img
  } catch {
    return null
  }
}

// ── Icon layout ──────────────────────────────────────────────────────────────
// Key is 112×112. Icons fill the upper ~80%; workspace label sits at the bottom.

interface IconEntry { app: string; img: any }

function IconRow({ entries }: { entries: IconEntry[] }) {
  const count = Math.min(entries.length, 4)
  if (count === 0) return null

  // size and x positions per count, centered in a 112px wide key
  const configs = [
    { size: 64, xs: [24],            y: 8  },  // 1 app — large, centered
    { size: 44, xs: [8, 60],         y: 12 },  // 2 apps — side by side
    { size: 34, xs: [5, 39, 73],     y: 16 },  // 3 apps — row of three
    { size: 28, xs: [8, 34, 60, 84], y: 20 },  // 4 apps — tight row
  ]
  const { size, xs, y } = configs[count - 1]

  return (
    <>
      {entries.slice(0, count).map(({ app, img }, i) => (
        <KonvaImage
          key={app}
          image={img}
          x={xs[i]} y={y}
          width={size} height={size}
          cornerRadius={size * 0.22}  // macOS-style rounded icon corners
        />
      ))}
    </>
  )
}

// ── WorkspaceKey ─────────────────────────────────────────────────────────────

function WorkspaceKey({ index, workspace, isActive }: {
  index: number
  workspace: string
  isActive: boolean
}) {
  const [appEntries, setAppEntries] = useState<IconEntry[]>([])

  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      const windows = await getWorkspaceWindows(workspace)
      if (cancelled) return

      // One icon per app, preserving order of first appearance
      const uniqueApps = [...new Map(windows.map(w => [w['app-name'], w])).keys()]

      // Load all icons in parallel; cache hit after first load per app
      const entries = await Promise.all(
        uniqueApps.map(async (app) => ({ app, img: await loadAppIcon(app) }))
      )
      if (!cancelled) setAppEntries(entries.filter(e => e.img !== null))
    }

    refresh()
    // Re-check every 3 s so newly opened/closed apps update on the key
    const id = setInterval(refresh, 3000)
    return () => { cancelled = true; clearInterval(id) }
  }, [workspace])

  return (
    <Key index={index} onKeyDown={() => aerospace(`workspace ${workspace}`)}>
      <Rect x={0} y={0} width={112} height={112}
            fill={isActive ? '#1d4ed8' : '#0f172a'} cornerRadius={6} />

      {/* Blue accent bar along the top edge when active */}
      {isActive && <Rect x={0} y={0} width={112} height={3} fill="#60a5fa" cornerRadius={2} />}

      {appEntries.length > 0 ? (
        <>
          <IconRow entries={appEntries} />
          <Text
            text={workspace}
            fill={isActive ? '#bfdbfe' : '#475569'}
            fontSize={13} fontStyle="bold"
            width={112} y={92}
            align="center"
          />
        </>
      ) : (
        // Empty workspace — show the name centered
        <Text
          text={workspace}
          fill={isActive ? 'white' : '#334155'}
          fontSize={36} fontStyle="bold"
          width={112} height={112}
          align="center" verticalAlign="middle"
        />
      )}
    </Key>
  )
}

// ── AerospaceControl ─────────────────────────────────────────────────────────

export interface AerospaceControlProps {
  workspaces?: string[]
  keyOffset?: number
}

const FOCUS_DIRECTIONS = [
  { label: '←', cmd: 'focus left' },
  { label: '↓', cmd: 'focus down' },
  { label: '↑', cmd: 'focus up' },
  { label: '→', cmd: 'focus right' },
] as const

export function AerospaceControl({
  workspaces = ['1', '2', '3', '4', '5', 'Q', 'W', 'E', 'R', 'T'],
  keyOffset = 1,
}: AerospaceControlProps) {
  const [focused, setFocused] = useState(() => getFocusedWorkspace())

  // Poll focused workspace at 500ms — cheap single CLI call
  useEffect(() => {
    const id = setInterval(() => setFocused(getFocusedWorkspace()), 500)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      {workspaces.map((ws, i) => (
        <WorkspaceKey
          key={ws}
          index={keyOffset + i}
          workspace={ws}
          isActive={focused === ws}
        />
      ))}

      {/* Touch keys: aerospace focus direction */}
      {FOCUS_DIRECTIONS.map(({ label, cmd }, i) => (
        <TouchKey key={cmd} index={i + 1} onClick={() => aerospace(cmd)}>
          <Rect x={0} y={0} width={176} height={112} fill="#0f172a" />
          <Text text={label} fill="#64748b" fontSize={36}
                width={176} height={112} align="center" verticalAlign="middle" />
        </TouchKey>
      ))}
    </>
  )
}
