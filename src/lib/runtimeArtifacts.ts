import { spawn } from 'node:child_process'
import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, extname, isAbsolute, posix, relative, resolve } from 'node:path'
import type { RuntimeSessionArtifact, RuntimeSessionArtifactKind, RuntimeSessionRecord } from './runtimeSessionTypes'

const MAX_ARTIFACT_FILES = 48
const MAX_WALK_DEPTH = 6
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'])
const TRACE_EXTENSIONS = new Set(['.zip', '.trace'])
const REPORT_EXTENSIONS = new Set(['.html', '.xml', '.json', '.md', '.txt', '.log'])

export type RuntimeSessionArtifactContent = {
  artifact: RuntimeSessionArtifact
  body: Buffer
}

function quotePosix(value: string): string {
  if (!value) return "''"
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function artifactSlug(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'artifact'
}

function formatBytes(sizeBytes: number | undefined): string | null {
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes < 0) return null
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} kB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

function guessMimeType(pathname: string): string | undefined {
  const extension = extname(pathname).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.gif') return 'image/gif'
  if (extension === '.svg') return 'image/svg+xml'
  if (extension === '.html') return 'text/html'
  if (extension === '.xml') return 'application/xml'
  if (extension === '.json') return 'application/json'
  if (extension === '.md') return 'text/markdown'
  if (extension === '.txt' || extension === '.log') return 'text/plain'
  if (extension === '.zip') return 'application/zip'
  if (extension === '.trace') return 'application/octet-stream'
  if (extension === '.pdf') return 'application/pdf'
  if (extension === '.csv') return 'text/csv'
  return undefined
}

function artifactKindForPath(pathname: string): RuntimeSessionArtifactKind {
  const extension = extname(pathname).toLowerCase()
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (TRACE_EXTENSIONS.has(extension) || pathname.includes('trace')) return 'trace'
  if (REPORT_EXTENSIONS.has(extension)) return 'report'
  return 'download'
}

function artifactTitleForPath(pathname: string): string {
  const filename = basename(pathname)
  if (pathname.includes('playwright-report') && filename === 'index.html') return 'Playwright HTML report'
  if (filename === 'playwright-junit.xml') return 'Playwright JUnit report'
  const kind = artifactKindForPath(pathname)
  if (kind === 'image') return `Screenshot ${filename}`
  if (kind === 'trace') return `Trace ${filename}`
  if (kind === 'report') return `Report ${filename}`
  return `Download ${filename}`
}

function artifactSummary(pathname: string, sizeBytes?: number): string {
  const sizeLabel = formatBytes(sizeBytes)
  return sizeLabel ? `${pathname} • ${sizeLabel}` : pathname
}

function normalizeRelativePath(baseDir: string, pathname: string): string {
  const next = isAbsolute(pathname) ? relative(baseDir, pathname) : pathname
  return next.split('\\').join('/')
}

function artifactTargetsForSession(session: RuntimeSessionRecord): string[] {
  const env = session.env ?? {}
  const profile = env.DEWDROPS_RUNTIME_PROFILE?.trim()
  const targets = new Set<string>()
  const artifactDir = env.DEWDROPS_ARTIFACT_DIR?.trim()

  if (artifactDir) targets.add(artifactDir)
  if (profile === 'playwright') {
    if (env.DEWDROPS_PLAYWRIGHT_OUTPUT_DIR?.trim()) targets.add(env.DEWDROPS_PLAYWRIGHT_OUTPUT_DIR.trim())
    if (env.PLAYWRIGHT_HTML_OUTPUT_DIR?.trim()) targets.add(env.PLAYWRIGHT_HTML_OUTPUT_DIR.trim())
    if (env.PLAYWRIGHT_JUNIT_OUTPUT_FILE?.trim()) targets.add(env.PLAYWRIGHT_JUNIT_OUTPUT_FILE.trim())
    if (targets.size === 0) {
      targets.add('test-results')
      targets.add('playwright-report')
    }
  }

  return [...targets]
}

async function walkLocalFiles(
  rootDir: string,
  target: string,
  seen: Set<string>,
  files: string[],
  depth = 0,
): Promise<void> {
  if (files.length >= MAX_ARTIFACT_FILES || depth > MAX_WALK_DEPTH) return
  const absoluteTarget = resolve(rootDir, target)
  let stats
  try {
    stats = await stat(absoluteTarget)
  } catch {
    return
  }

  if (stats.isFile()) {
    const relativePath = normalizeRelativePath(rootDir, absoluteTarget)
    if (!seen.has(relativePath)) {
      seen.add(relativePath)
      files.push(relativePath)
    }
    return
  }

  if (!stats.isDirectory()) return
  const entries = await readdir(absoluteTarget, { withFileTypes: true })
  for (const entry of entries) {
    if (files.length >= MAX_ARTIFACT_FILES) break
    const nextRelative = posix.join(target.split('\\').join('/'), entry.name)
    if (entry.isDirectory()) {
      await walkLocalFiles(rootDir, nextRelative, seen, files, depth + 1)
      continue
    }
    if (!entry.isFile()) continue
    const normalizedPath = normalizeRelativePath(rootDir, nextRelative)
    if (seen.has(normalizedPath)) continue
    seen.add(normalizedPath)
    files.push(normalizedPath)
  }
}

async function listLocalArtifactPaths(session: RuntimeSessionRecord): Promise<string[]> {
  const targets = artifactTargetsForSession(session)
  const seen = new Set<string>()
  const files: string[] = []
  for (const target of targets) {
    if (files.length >= MAX_ARTIFACT_FILES) break
    await walkLocalFiles(session.cwd, target, seen, files)
  }
  return files.sort()
}

async function listRemoteArtifactPaths(session: RuntimeSessionRecord): Promise<string[]> {
  const hostAlias = session.env?.DEWDROPS_RUNTIME_VPN_ALIAS?.trim()
  if (!hostAlias) return []
  const targets = artifactTargetsForSession(session)
  if (targets.length === 0) return []

  const script = [
    `cd ${quotePosix(session.cwd)}`,
    `for target in ${targets.map((target) => quotePosix(target)).join(' ')}; do`,
    '  if [ -d "$target" ]; then',
    '    find "$target" -type f -print',
    '  elif [ -f "$target" ]; then',
    '    printf "%s\\n" "$target"',
    '  fi',
    'done',
  ].join('; ')

  return new Promise<string[]>((resolvePromise) => {
    let stdout = ''
    let settled = false
    const resolveOnce = (paths: string[]) => {
      if (settled) return
      settled = true
      resolvePromise(paths)
    }

    const child = spawn(
      'ssh',
      [
        '-o',
        'BatchMode=yes',
        '-o',
        'ConnectTimeout=4',
        '-o',
        'StrictHostKeyChecking=accept-new',
        hostAlias,
        'sh',
        '-lc',
        script,
      ],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    )

    const timeoutHandle = setTimeout(() => {
      child.kill('SIGKILL')
      resolveOnce([])
    }, 5000)

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString()
    })
    child.on('error', () => {
      clearTimeout(timeoutHandle)
      resolveOnce([])
    })
    child.on('exit', (code) => {
      clearTimeout(timeoutHandle)
      if (code !== 0) {
        resolveOnce([])
        return
      }
      const paths = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, MAX_ARTIFACT_FILES)
      resolveOnce([...new Set(paths)].sort())
    })
  })
}

async function describeLocalArtifact(
  session: RuntimeSessionRecord,
  relativePath: string,
): Promise<RuntimeSessionArtifact> {
  const absolutePath = resolve(session.cwd, relativePath)
  let sizeBytes: number | undefined
  try {
    sizeBytes = (await stat(absolutePath)).size
  } catch {
    sizeBytes = undefined
  }
  return {
    id: artifactSlug(relativePath),
    kind: artifactKindForPath(relativePath),
    title: artifactTitleForPath(relativePath),
    summary: artifactSummary(relativePath, sizeBytes),
    path: relativePath,
    mimeType: guessMimeType(relativePath),
    sizeBytes,
  }
}

function describeRemoteArtifact(relativePath: string): RuntimeSessionArtifact {
  return {
    id: artifactSlug(relativePath),
    kind: artifactKindForPath(relativePath),
    title: artifactTitleForPath(relativePath),
    summary: artifactSummary(relativePath),
    path: relativePath,
    mimeType: guessMimeType(relativePath),
  }
}

async function readRemoteArtifactContent(
  session: RuntimeSessionRecord,
  relativePath: string,
): Promise<Buffer> {
  const hostAlias = session.env?.DEWDROPS_RUNTIME_VPN_ALIAS?.trim()
  if (!hostAlias) {
    throw new Error('Remote DewDrop host is missing.')
  }

  const script = [`cd ${quotePosix(session.cwd)}`, `cat ${quotePosix(relativePath)}`].join('; ')
  return new Promise<Buffer>((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = []
    const child = spawn(
      'ssh',
      [
        '-o',
        'BatchMode=yes',
        '-o',
        'ConnectTimeout=4',
        '-o',
        'StrictHostKeyChecking=accept-new',
        hostAlias,
        'sh',
        '-lc',
        script,
      ],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const timeoutHandle = setTimeout(() => {
      child.kill('SIGKILL')
      rejectPromise(new Error('Timed out reading the remote DewDrop artifact.'))
    }, 8000)

    child.stdout.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    })
    child.on('error', (error) => {
      clearTimeout(timeoutHandle)
      rejectPromise(error)
    })
    child.on('exit', (code) => {
      clearTimeout(timeoutHandle)
      if (code !== 0) {
        rejectPromise(new Error(`SSH exited with code ${code ?? 'unknown'} while reading the DewDrop artifact.`))
        return
      }
      resolvePromise(Buffer.concat(chunks))
    })
  })
}

export async function listRuntimeArtifactsForSession(
  session: RuntimeSessionRecord,
): Promise<RuntimeSessionArtifact[]> {
  const route = session.env?.DEWDROPS_RUNTIME_ROUTE?.trim() || 'local'
  if (route === 'vpn-ssh') {
    const paths = await listRemoteArtifactPaths(session)
    return paths.map(describeRemoteArtifact)
  }

  const paths = await listLocalArtifactPaths(session)
  return Promise.all(paths.map((relativePath) => describeLocalArtifact(session, relativePath)))
}

export async function readRuntimeArtifactContentForSession(
  session: RuntimeSessionRecord,
  artifactId: string,
): Promise<RuntimeSessionArtifactContent> {
  const artifacts = await listRuntimeArtifactsForSession(session)
  const artifact = artifacts.find((candidate) => candidate.id === artifactId)
  if (!artifact) {
    throw new Error('Artifact not found.')
  }
  const relativePath = artifact.path
  if (!relativePath) {
    throw new Error('Artifact path is missing.')
  }

  const route = session.env?.DEWDROPS_RUNTIME_ROUTE?.trim() || 'local'
  const body =
    route === 'vpn-ssh'
      ? await readRemoteArtifactContent(session, relativePath)
      : await readFile(resolve(session.cwd, relativePath))

  return {
    artifact,
    body,
  }
}
