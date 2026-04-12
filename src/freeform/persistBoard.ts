import type { BoardCamera, BoardWire, WorkflowCard } from './types'
import { hedgerowsPresetAgentCount } from './presets/hedgerowsDeltaSquad'

export const BOARD_STORAGE_KEY = 'dewdrops-board-state'

const PERSIST_VERSION = 1 as const

export type PersistedBoardV1 = {
  v: typeof PERSIST_VERSION
  camera: BoardCamera
  cards: WorkflowCard[]
  wires: BoardWire[]
}

export function buildBoardPayload(
  camera: BoardCamera,
  cards: WorkflowCard[],
  wires: BoardWire[],
): PersistedBoardV1 {
  return { v: PERSIST_VERSION, camera, cards, wires }
}

/** Pretty JSON for downloads / sharing (same schema as localStorage). */
export function stringifyBoard(camera: BoardCamera, cards: WorkflowCard[], wires: BoardWire[]): string {
  return JSON.stringify(buildBoardPayload(camera, cards, wires), null, 2)
}

/** Parse a `.json` file or pasted string; same validation as saved browser state. */
export function parseBoardJsonString(text: string): PersistedBoardV1 | null {
  try {
    return parsePersistedBoardJson(JSON.parse(text) as unknown)
  } catch {
    return null
  }
}

function isNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

function isStr(s: unknown): s is string {
  return typeof s === 'string'
}

function isBool(b: unknown): b is boolean {
  return typeof b === 'boolean'
}

function isKind(k: unknown): k is WorkflowCard['kind'] {
  return k === 'problem' || k === 'agent' || k === 'surface'
}

/** Exported for tests — validate JSON without touching localStorage. */
export function parsePersistedBoardJson(raw: unknown): PersistedBoardV1 | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.v !== PERSIST_VERSION) return null

  const cam = o.camera
  if (!cam || typeof cam !== 'object') return null
  const c = cam as Record<string, unknown>
  if (!isNum(c.x) || !isNum(c.y) || !isNum(c.zoom) || c.zoom <= 0) return null
  const camera: BoardCamera = { x: c.x, y: c.y, zoom: c.zoom }

  if (!Array.isArray(o.cards)) return null
  const cards: WorkflowCard[] = []
  for (const item of o.cards) {
    if (!item || typeof item !== 'object') return null
    const w = item as Record<string, unknown>
    if (
      !isStr(w.id) ||
      !isNum(w.x) ||
      !isNum(w.y) ||
      !isNum(w.width) ||
      !isNum(w.height) ||
      w.width <= 0 ||
      w.height <= 0 ||
      !isStr(w.title) ||
      !isBool(w.expanded) ||
      !isStr(w.color) ||
      !isKind(w.kind)
    ) {
      return null
    }
    const card: WorkflowCard = {
      id: w.id,
      x: w.x,
      y: w.y,
      width: w.width,
      height: w.height,
      title: w.title,
      expanded: w.expanded,
      color: w.color,
      kind: w.kind,
    }
    if (w.problemShape === 'bubble' || w.problemShape === 'panel') card.problemShape = w.problemShape
    if (isNum(w.problemBaseWidth)) card.problemBaseWidth = w.problemBaseWidth
    if (isNum(w.problemBaseHeight)) card.problemBaseHeight = w.problemBaseHeight
    if (w.assignedToProblemId === null || isStr(w.assignedToProblemId)) {
      card.assignedToProblemId = w.assignedToProblemId as string | null
    }
    if (w.parentAgentId === null || isStr(w.parentAgentId)) {
      card.parentAgentId = w.parentAgentId as string | null
    }
    if (w.management === 'manual' || w.management === 'auto') card.management = w.management
    if (isStr(w.mission)) card.mission = w.mission
    if (Array.isArray(w.openQuestions) && w.openQuestions.every(isStr)) {
      card.openQuestions = w.openQuestions as string[]
    }
    if (isBool(w.releaseNodFromSpecialist)) card.releaseNodFromSpecialist = w.releaseNodFromSpecialist
    if (isBool(w.releaseNodFromLead)) card.releaseNodFromLead = w.releaseNodFromLead
    if (isStr(w.lastProjectRecall)) card.lastProjectRecall = w.lastProjectRecall
    cards.push(card)
  }

  const wires: BoardWire[] = []
  if (Array.isArray(o.wires)) {
    for (const item of o.wires) {
      if (!item || typeof item !== 'object') return null
      const wire = item as Record<string, unknown>
      if (!isStr(wire.id) || !isStr(wire.fromCardId) || !isStr(wire.toCardId)) return null
      wires.push({ id: wire.id, fromCardId: wire.fromCardId, toCardId: wire.toCardId })
    }
  }

  return { v: PERSIST_VERSION, camera, cards, wires }
}

export function loadPersistedBoard(): PersistedBoardV1 | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const s = localStorage.getItem(BOARD_STORAGE_KEY)
    if (!s) return null
    return parsePersistedBoardJson(JSON.parse(s) as unknown)
  } catch {
    return null
  }
}

export function savePersistedBoard(camera: BoardCamera, cards: WorkflowCard[], wires: BoardWire[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    const payload = buildBoardPayload(camera, cards, wires)
    localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

export function clearPersistedBoard(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(BOARD_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** Next “Agent N” index after restore (avoids duplicate titles when summoning). */
export function inferAgentSummonCount(cards: WorkflowCard[]): number {
  let max = hedgerowsPresetAgentCount()
  for (const c of cards) {
    if (c.kind !== 'agent') continue
    const m = /^Agent (\d+)$/.exec(c.title.trim())
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max
}
