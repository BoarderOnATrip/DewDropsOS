import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { flushSync } from 'react-dom'
import type { ArtifactStatus, BoardCamera, BoardWire, DewDropsWorkspaceMode, WorkflowCard } from './types'
import { hedgerowsDeltaSquadCards, hedgerowsPresetAgentCount } from './presets/hedgerowsDeltaSquad'
import { PRESET_REGISTRY, type PresetEntry } from './presets/index'
import { PresetPicker } from './components/PresetPicker'
import {
  ButlerBridgeError,
  createSwarmContract,
  getButlerBridgeHealth,
  getSwarmRunReport,
  launchSwarmContract,
  listSwarmRuns,
  loadButlerBridgeSettings,
  pairLocalBridge,
  saveButlerBridgeSettings,
  sendUiTraceEvent,
  stopSwarmRun,
  type ButlerBridgeHealth,
  type ButlerBridgeSettings,
  type ButlerSwarmRunAgent,
  type ButlerSwarmRun,
  type ButlerSwarmRunReport,
  type ButlerSwarmTemplate,
} from '../lib/butlerBridge'
import {
  PaperclipBridgeError,
  addPaperclipIssueComment,
  createPaperclipIssue,
  invokePaperclipAgent,
  listPaperclipAgents,
  listPaperclipCompanies,
  listPaperclipIssueWorkProducts,
  listPaperclipProjects,
  loadPaperclipBridgeSettings,
  savePaperclipBridgeSettings,
  updatePaperclipWorkProduct,
  upsertPaperclipIssueDocument,
  type PaperclipAgent,
  type PaperclipBridgeSettings,
  type PaperclipCompany,
  type PaperclipProject,
} from '../lib/paperclipBridge'
import {
  buildBoardPayload,
  inferAgentSummonCount,
  loadPersistedBoard,
  parseBoardJsonString,
  savePersistedBoard,
  stringifyBoard,
  type PersistedBoardV1,
} from './persistBoard'
import { buildProblemSwarmObjective } from './boardObjective'
import { touchPairMetrics } from './boardTouch'
import { bumpBriefVersion, compileBriefPacket } from './briefCompiler'
import { normalizeBriefSpec } from './briefSpec'
import {
  defaultCommandForRuntimeProfile,
  defaultTerminalRuntime,
  normalizeAgentRuntime,
  normalizeAgentRuntimeCard,
} from './agentRuntime'
import {
  createWorkerTerminalSession,
  getWorkerTerminalSession,
  listWorkerTerminalSessions,
  resizeWorkerTerminalSession,
  sendWorkerTerminalSessionInput,
  stopWorkerTerminalSession,
  workerTerminalStateFromSession,
} from '../lib/workerTerminalBridge'
import { applyCapabilityPack, getCapabilityPack, listCapabilityPacks, resolveCapabilityPackId, syncCapabilityPack } from './capabilityPacks'
import { listCapabilityProfiles } from './capabilityProfiles'
import { buildBriefCompartmentOptions, createBriefCompartmentAsset } from './briefCompartments'
import { DewDropTerminalCard } from './components/DewDropTerminalCard'
import { ProblemSwarmInspector } from './components/ProblemSwarmInspector'
import { SwarmEnvelopeLayer } from './components/SwarmEnvelopeLayer'
import { SwarmRunList } from './components/SwarmRunList'
import { WorkflowCardView, type ProblemSessionSummary } from './components/WorkflowCardView'
import { agentSubUnionBounds, bestGroupProblemTarget, bestParentAgentTarget, bestProblemOverlap } from './cardOverlap'
import { DEFAULT_KANBAN_MIN_AGENT_WIDTH, cardDisplayHeight, magneticKanbanDockPosition } from './kanbanGeometry'
import { reflowHubKanbanLayout, reflowSubagentLayout } from './kanbanReflow'
import { openQuestionsForCard } from './openQuestions'
import { applyReleaseNod } from './releaseNod'
import { buildRunLedgerEntry, updateRunArtifactStatus, upsertRunLedgerEntry } from './runLedger'
import { clampNumber, swarmRunIsActive } from './runFormat'
import { buildProblemSessionReadiness } from './sessionReadiness'
import {
  buildProblemSessionBlueprint,
  formatAnchorInput,
  LAUNCH_SURFACE_OPTIONS,
  parseAnchorInput,
  WORKSPACE_MODE_OPTIONS,
} from './sessionBlueprint'
import { buildProblemLaunchMetadata } from './launchMetadata'
import { buildSwarmContractAgents } from './swarmContractAgents'
import { getSwarmRecipe, listSwarmRecipes } from './swarmRecipes'
import {
  buildVisualMemoryPalace,
  formatVisualMemoryPalaceDraft,
  parseVisualMemoryPalaceDraft,
} from './visualMemoryPalace'
import { shouldDraggedAgentStayAttached } from './dragDetach'
import {
  ENVELOPE_STAY_SLACK,
  DEFAULT_SWARM_ENVELOPE_PAD,
  agentsInProblemSwarm,
  expandBounds,
  normalizeProblemFootprint,
  pointInBounds,
  problemEnvelopePad,
  problemEnvelopeStaySlack,
  swarmUnionBounds,
} from './swarmAgents'
import { stepProblemOverlapEjection } from './problemOverlapEjection'
import {
  cardWorldBounds,
  fitCameraToCards,
  marqueeViewportToWorldAabb,
  worldRectsIntersect,
  zoomAtPoint,
} from './viewportGeometry'
import { eventPathHitsBoardCard, pointerEventTargetEl } from './pointerDom'
import './board.css'

function paperclipReviewStateForArtifactStatus(status: ArtifactStatus) {
  if (status === 'accepted') return 'approved' as const
  if (status === 'rejected') return 'changes_requested' as const
  return 'needs_board_review' as const
}

function paperclipStatusForArtifactStatus(status: ArtifactStatus) {
  if (status === 'accepted') return 'approved' as const
  if (status === 'rejected') return 'changes_requested' as const
  return 'ready_for_review' as const
}

function executionWorkspaceModeForRecipe(recipeId: string | undefined) {
  const recipe = recipeId ? getSwarmRecipe(recipeId) : undefined
  if (!recipe?.worktreeStrategy) return undefined
  if (recipe.worktreeStrategy === 'shared') return 'shared_workspace' as const
  return 'isolated_workspace' as const
}

let cardId = 0
function newCardId(): string {
  cardId += 1
  return `wf-${cardId}`
}

function boardCardIdAtClientPoint(clientX: number, clientY: number): string | null {
  if (typeof document === 'undefined' || typeof document.elementsFromPoint !== 'function') {
    return null
  }
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    const card = el.closest('[data-board-card]')
    if (card instanceof HTMLElement) {
      return card.dataset.boardCard ?? null
    }
  }
  return null
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  if (typeof document === 'undefined' || !document.body) {
    throw new Error('Clipboard is unavailable in this browser session.')
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = typeof document.execCommand === 'function' ? document.execCommand('copy') : false
  document.body.removeChild(textarea)
  if (!copied) {
    throw new Error('Clipboard is unavailable in this browser session.')
  }
}

/** Default board = Hedgerows 2.0 Δ squad (virtual company preset). */
const SEED_CARDS: WorkflowCard[] = hedgerowsDeltaSquadCards()

type BootState = { cards: WorkflowCard[]; camera: BoardCamera; wires: BoardWire[] }
type BoardViewProps = {
  bootState?: BootState
  bootId?: string
  syncToken?: number | string
  workspaceId?: string
  workspaceName?: string
  workspaceOptions?: Array<{ id: string; name: string }>
  focusedProblemId?: string | null
  onFocusedProblemChange?: (problemId: string | null) => void
  onWorkspaceChange?: (workspaceId: string) => void
  onCreateWorkspace?: (presetId: string) => void
  workspacePresets?: readonly PresetEntry[]
  onDuplicateWorkspace?: () => void
  onRenameWorkspace?: (name: string) => void
  onDeleteWorkspace?: () => void
  onOpenWorldShell?: (problemId: string | null) => void
  onOpenPhoneRelay?: (problemId: string | null) => void
}

function getDefaultBootState(): BootState {
  const p = loadPersistedBoard()
  return {
    cards: p?.cards ?? SEED_CARDS,
    camera: p?.camera ?? { x: 0, y: 0, zoom: 1 },
    wires: p?.wires ?? [],
  }
}

function syncProblemBriefBindings(problem: WorkflowCard): WorkflowCard {
  if (problem.kind !== 'problem' || !problem.briefSpec) return problem
  const briefSpec = normalizeBriefSpec(problem.briefSpec, problem.briefSpec.id ?? `brief-${problem.id}`)
  const capabilityProfileId = problem.capabilityProfileId?.trim() || undefined
  const swarmRecipeId = problem.swarmRecipeId?.trim() || undefined
  if (
    briefSpec.capabilityProfileId === capabilityProfileId &&
    briefSpec.swarmRecipeId === swarmRecipeId
  ) {
    return problem.briefSpec === briefSpec ? problem : { ...problem, briefSpec }
  }
  return {
    ...problem,
    briefSpec: {
      ...briefSpec,
      capabilityProfileId,
      swarmRecipeId,
    },
  }
}

function editableProblemBriefSpec(problem: WorkflowCard) {
  const briefSpec = normalizeBriefSpec(problem.briefSpec, `brief-${problem.id}`)
  return {
    ...briefSpec,
    capabilityProfileId: problem.capabilityProfileId?.trim() || briefSpec.capabilityProfileId,
    swarmRecipeId: problem.swarmRecipeId?.trim() || briefSpec.swarmRecipeId,
  }
}

function normalizeBoardCards(cards: readonly WorkflowCard[]): WorkflowCard[] {
  return cards.map((card) => {
    let next = card
    if (next.kind === 'agent') {
      next = normalizeAgentRuntimeCard(next)
    }
    if (next.kind === 'problem' && next.briefSpec) {
      const briefSpec = normalizeBriefSpec(next.briefSpec, next.briefSpec.id ?? `brief-${next.id}`)
      if (briefSpec !== next.briefSpec) {
        next = { ...next, briefSpec }
      }
    }
    return next
  })
}

function isTerminalTypingTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null
  if (!element) return false
  return !!element.closest(
    'input, textarea, select, [contenteditable="true"], .freeform-terminal-surface, .freeform-terminal-canvas, .xterm, .xterm-helper-textarea',
  )
}

function buildProblemBriefPacket(problem: WorkflowCard) {
  return compileBriefPacket(syncProblemBriefBindings(problem), problem.butlerRoomId?.trim() || problem.id)
}

function problemCardById(cards: readonly WorkflowCard[], problemId: string | null | undefined): WorkflowCard | null {
  if (!problemId) return null
  const card = cards.find((item) => item.id === problemId && item.kind === 'problem')
  return card ?? null
}

const SWARM_TEMPLATE_OPTIONS: Array<{ value: ButlerSwarmTemplate; label: string }> = [
  { value: 'planning', label: 'Planning' },
  { value: 'build', label: 'Build' },
  { value: 'research', label: 'Research' },
  { value: 'operator', label: 'Operator' },
  { value: 'relationship', label: 'Relationship' },
]

const CAPABILITY_PROFILE_OPTIONS = listCapabilityProfiles().map((profile) => ({
  value: profile.id,
  label: profile.label,
  detail: profile.description,
  hint: profile.budgetHint ? `Budget: ${profile.budgetHint}` : undefined,
}))

const CAPABILITY_PACK_OPTIONS = listCapabilityPacks().map((pack) => ({
  value: pack.id,
  label: pack.label,
  detail: pack.description,
  summary: `${pack.template} • ${pack.capabilityProfileId} • ${pack.swarmRecipeId}`,
}))

const SWARM_RECIPE_OPTIONS = listSwarmRecipes().map((recipe) => ({
  value: recipe.id,
  label: recipe.label,
  detail: recipe.description,
  template: recipe.template,
}))

const BULK_SUMMON_COUNT = 48
const BULK_SUMMON_COLORS = [
  '#5ac8fa',
  '#64d2ff',
  '#30d158',
  '#ff9f0a',
  '#bf5af2',
  '#ffd60a',
  '#0a84ff',
  '#5e5ce6',
  '#ff375f',
  '#66d4cf',
  '#ff6482',
  '#c4c4c4',
]

const TOOLBAR_PANEL_OPEN_KEY = 'dewdrops-toolbar-panel-open'
const WORKSPACE_MODE_KEY = 'dewdrops-workspace-mode'

function loadToolbarPanelOpen(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(TOOLBAR_PANEL_OPEN_KEY) === '1'
  } catch {
    return false
  }
}

function saveToolbarPanelOpen(next: boolean): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(TOOLBAR_PANEL_OPEN_KEY, next ? '1' : '0')
  } catch {
    // Ignore localStorage failures.
  }
}

function loadWorkspaceMode(): DewDropsWorkspaceMode {
  if (typeof localStorage === 'undefined') return 'desktop'
  try {
    const raw = localStorage.getItem(WORKSPACE_MODE_KEY)
    if (raw === 'phone' || raw === 'palace' || raw === 'desktop') return raw
  } catch {
    // Ignore localStorage failures.
  }
  return 'desktop'
}

function saveWorkspaceMode(next: DewDropsWorkspaceMode): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(WORKSPACE_MODE_KEY, next)
  } catch {
    // Ignore localStorage failures.
  }
}

function cameraShowsAnyCards(
  camera: BoardCamera,
  cards: WorkflowCard[],
  viewportWidth: number,
  viewportHeight: number,
): boolean {
  if (cards.length === 0 || viewportWidth <= 0 || viewportHeight <= 0) return true
  const viewportBounds = marqueeViewportToWorldAabb(
    0,
    0,
    viewportWidth,
    viewportHeight,
    viewportWidth,
    viewportHeight,
    camera,
  )
  return cards.some((card) => worldRectsIntersect(cardWorldBounds(card), viewportBounds))
}

type SelectionTraceEntry = {
  id: number
  label: string
  detail: string
}

export default function BoardView({
  bootState,
  bootId = 'default',
  syncToken,
  workspaceId,
  workspaceName,
  workspaceOptions = [],
  focusedProblemId,
  onFocusedProblemChange,
  onWorkspaceChange,
  onCreateWorkspace,
  workspacePresets = PRESET_REGISTRY,
  onDuplicateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onOpenWorldShell,
  onOpenPhoneRelay,
}: BoardViewProps) {
  const isJsdomRuntime = typeof navigator !== 'undefined' && /\bjsdom\b/i.test(navigator.userAgent)
  const initialBootState = bootState ?? getDefaultBootState()
  const normalizedInitialCards = useMemo(() => normalizeBoardCards(initialBootState.cards), [initialBootState.cards])
  const viewportRef = useRef<HTMLDivElement>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  const [size, setSize] = useState({ w: 960, h: 640 })
  const [camera, setCamera] = useState<BoardCamera>(() => initialBootState.camera)
  const [cards, setCards] = useState<WorkflowCard[]>(() => normalizedInitialCards)
  const [wires, setWires] = useState<BoardWire[]>(() => initialBootState.wires)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [handshakeFocus, setHandshakeFocus] = useState<{ agentId: string; problemId: string } | null>(
    null,
  )
  const [boardNotice, setBoardNotice] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null)
  const [bridgeSettings, setBridgeSettings] = useState<ButlerBridgeSettings>(() => loadButlerBridgeSettings())
  const [bridgeHealth, setBridgeHealth] = useState<ButlerBridgeHealth | null>(null)
  const [bridgeBusy, setBridgeBusy] = useState(false)
  const [paperclipSettings, setPaperclipSettings] = useState<PaperclipBridgeSettings>(() =>
    loadPaperclipBridgeSettings(),
  )
  const [paperclipBusy, setPaperclipBusy] = useState(false)
  const [paperclipOnline, setPaperclipOnline] = useState(false)
  const [paperclipCompanies, setPaperclipCompanies] = useState<PaperclipCompany[]>([])
  const [paperclipProjects, setPaperclipProjects] = useState<PaperclipProject[]>([])
  const [paperclipAgents, setPaperclipAgents] = useState<PaperclipAgent[]>([])
  const [paperclipLaunchBusy, setPaperclipLaunchBusy] = useState(false)
  const [launchBusy, setLaunchBusy] = useState(false)
  const [stopBusy, setStopBusy] = useState(false)
  const [workerTerminalBusyIds, setWorkerTerminalBusyIds] = useState<string[]>([])
  const [recentRuns, setRecentRuns] = useState<ButlerSwarmRun[]>([])
  const [currentRunId, setCurrentRunId] = useState('')
  const [currentRunReport, setCurrentRunReport] = useState<ButlerSwarmRunReport | null>(null)
  const [currentRunReportBusy, setCurrentRunReportBusy] = useState(false)
  const [launchTemplate, setLaunchTemplate] = useState<ButlerSwarmTemplate>('planning')
  const [launchObjective, setLaunchObjective] = useState('')
  const [workspaceMode, setWorkspaceMode] = useState<DewDropsWorkspaceMode>(() => loadWorkspaceMode())
  const [toolbarPanelOpen, setToolbarPanelOpen] = useState(() => loadToolbarPanelOpen())
  const [presetPickerOpen, setPresetPickerOpen] = useState(false)
  const [traceEnabled, setTraceEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    if (typeof navigator !== 'undefined' && /\bjsdom\b/i.test(navigator.userAgent)) return false
    return window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  })
  const [selectionTrace, setSelectionTrace] = useState<SelectionTraceEntry[]>([])
  const sizeRef = useRef(size)
  const cameraRef = useRef(camera)
  const cardsRef = useRef(cards)
  const wiresRef = useRef(wires)

  const traceSeqRef = useRef(0)
  /** Hub overlap ejection pauses while these cards are being dragged or resized. */
  const ejectionDragIdsRef = useRef<Set<string>>(new Set())
  /** Any pointer down on a card — pauses ejection so clicks/drags don’t fight the sim. */
  const suppressOverlapEjectionRef = useRef(false)
  const markUserMovingCard = useCallback((id: string) => {
    ejectionDragIdsRef.current.add(id)
  }, [])
  const beginCardPointerSession = useCallback(() => {
    suppressOverlapEjectionRef.current = true
  }, [])
  const handshakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persistBridgeSettings = useCallback((next: ButlerBridgeSettings) => {
    const normalized = saveButlerBridgeSettings(next)
    setBridgeSettings(normalized)
    return normalized
  }, [])

  const persistPaperclipSettings = useCallback((next: PaperclipBridgeSettings) => {
    const normalized = savePaperclipBridgeSettings(next)
    setPaperclipSettings(normalized)
    return normalized
  }, [])

  const fireConnectHandshake = useCallback((agentId: string, problemId: string) => {
    if (handshakeTimerRef.current) clearTimeout(handshakeTimerRef.current)
    setHandshakeFocus({ agentId, problemId })
    handshakeTimerRef.current = setTimeout(() => {
      setHandshakeFocus(null)
      handshakeTimerRef.current = null
    }, 14000)
  }, [])

  useEffect(
    () => () => {
      if (handshakeTimerRef.current) clearTimeout(handshakeTimerRef.current)
    },
    [],
  )

  const pushSelectionTrace = useCallback(
    (label: string, detail: string, selectedSnapshot: string[] = selectedIds) => {
      if (!traceEnabled) return
      traceSeqRef.current += 1
      const entry = { id: traceSeqRef.current, label, detail }
      setSelectionTrace((prev) =>
        [entry, ...prev].slice(0, 14),
      )
      void sendUiTraceEvent(bridgeSettings, {
        surface: 'dewdrops',
        label,
        detail,
        selected_ids: selectedSnapshot,
        metadata: {
          trace_id: entry.id,
        },
      }).catch(() => {})
    },
    [bridgeSettings, selectedIds, traceEnabled],
  )

  useEffect(() => {
    pushSelectionTrace(
      'selection',
      selectedIds.length > 0 ? selectedIds.join(', ') : 'none',
      selectedIds,
    )
  }, [pushSelectionTrace, selectedIds])

  useEffect(() => {
    saveToolbarPanelOpen(toolbarPanelOpen)
  }, [toolbarPanelOpen])

  useEffect(() => {
    saveWorkspaceMode(workspaceMode)
  }, [workspaceMode])

  useEffect(() => {
    const clearEjectionDrag = () => {
      ejectionDragIdsRef.current.clear()
      suppressOverlapEjectionRef.current = false
    }
    window.addEventListener('pointerup', clearEjectionDrag)
    window.addEventListener('pointercancel', clearEjectionDrag)
    return () => {
      window.removeEventListener('pointerup', clearEjectionDrag)
      window.removeEventListener('pointercancel', clearEjectionDrag)
    }
  }, [])

  useEffect(() => {
    if (isJsdomRuntime) return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.055, (now - last) / 1000)
      last = now
      const dragging = new Set(ejectionDragIdsRef.current)
      setCards((prev) => {
        if (suppressOverlapEjectionRef.current || dragging.size > 0) return prev
        const next = stepProblemOverlapEjection(prev, wiresRef.current, dt, dragging)
        return next === prev ? prev : next
      })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [isJsdomRuntime])

  const swarmLayoutKey = useMemo(() => {
    const agentBits = cards
      .filter((c) => c.kind === 'agent')
      .map((c) => `${c.id}:${c.assignedToProblemId ?? ''}`)
      .sort()
      .join(',')
    const wireBits = wires
      .map((w) => `${w.fromCardId}->${w.toCardId}`)
      .sort()
      .join(',')
    const baseBits = cards
      .filter((c) => c.kind === 'problem')
      .map((p) => `${p.id}:${p.problemBaseWidth ?? ''}:${p.problemBaseHeight ?? ''}`)
      .sort()
      .join(',')
    return `${agentBits}|${wireBits}|${baseBits}`
  }, [cards, wires])

  useEffect(() => {
    /* Footprint reflow when swarm membership / wires change — keep problem hubs sized to mass. */
    setCards((prev) => {
      const next = normalizeProblemFootprint(prev, wires)
      return next === prev ? prev : next
    })
  }, [swarmLayoutKey, wires])

  const agentSummon = useRef(inferAgentSummonCount(normalizedInitialCards))
  
  useEffect(() => {
    if (isJsdomRuntime) return
    const id = window.setTimeout(() => {
      savePersistedBoard(camera, cards, wires)
    }, 500)
    return () => window.clearTimeout(id)
  }, [camera, cards, isJsdomRuntime, wires])

  useEffect(() => {
    const next = bootState ?? getDefaultBootState()
    const normalizedNextCards = normalizeBoardCards(next.cards)
    const currentSnapshot = JSON.stringify(
      buildBoardPayload(cameraRef.current, cardsRef.current, wiresRef.current),
    )
    const nextSnapshot = JSON.stringify(buildBoardPayload(next.camera, normalizedNextCards, next.wires))
    if (currentSnapshot === nextSnapshot) return
    if (handshakeTimerRef.current) {
      clearTimeout(handshakeTimerRef.current)
      handshakeTimerRef.current = null
    }
    const restoredCamera = cameraShowsAnyCards(
      next.camera,
      normalizedNextCards,
      sizeRef.current.w,
      sizeRef.current.h,
    )
      ? next.camera
      : fitCameraToCards(normalizedNextCards, sizeRef.current.w, sizeRef.current.h)
    setCamera(restoredCamera)
    setCards(normalizedNextCards)
    setWires(next.wires)
    setSelectedIds([])
    setMarquee(null)
    setHandshakeFocus(null)
    setCurrentRunId('')
    setCurrentRunReport(null)
    agentSummon.current = inferAgentSummonCount(normalizedNextCards)
  }, [bootId, bootState, syncToken])
  const [isPanning, setIsPanning] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)

  const spaceDown = useRef(false)
  const panRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null)
  /** Marquee selection on empty board (viewport coords). */
  const marqueePointerRef = useRef<{
    pointerId: number
    ox: number
    oy: number
  } | null>(null)
  const [marquee, setMarquee] = useState<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)
  useEffect(() => {
    cardsRef.current = cards
    wiresRef.current = wires
    sizeRef.current = size
    cameraRef.current = camera
  }, [cards, wires, size, camera])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      if (isTerminalTypingTarget(e.target)) return
      e.preventDefault()
      spaceDown.current = true
      setSpaceHeld(true)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown.current = false
        setSpaceHeld(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, { passive: false })
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return
      if (isTerminalTypingTarget(e.target)) return
      setSelectedIds([])
      setMarquee(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - size.w / 2) / camera.zoom + camera.x,
      y: (sy - size.h / 2) / camera.zoom + camera.y,
    }),
    [camera.x, camera.y, camera.zoom, size.h, size.w],
  )

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!rect) return
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const pinchZoom = e.ctrlKey || e.metaKey
      if (pinchZoom) {
        const factor = Math.exp(-e.deltaY * 0.0022)
        setCamera((c) => zoomAtPoint(c, size.w, size.h, sx, sy, factor))
        return
      }
      setCamera((c) => {
        const panX = (e.shiftKey ? e.deltaY : e.deltaX) / c.zoom
        const panY = (e.shiftKey ? 0 : e.deltaY) / c.zoom
        return { ...c, x: c.x + panX, y: c.y + panY }
      })
    },
    [size.h, size.w],
  )

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    let pinch: { lastD: number; lastCx: number; lastCy: number } | null = null

    const onTouchStart = (ev: TouchEvent) => {
      if (ev.touches.length === 2) {
        ev.preventDefault()
        const r = el.getBoundingClientRect()
        const m = touchPairMetrics(ev.touches[0], ev.touches[1], r)
        pinch = { lastD: m.dist, lastCx: m.cx, lastCy: m.cy }
      }
    }

    const onTouchMove = (ev: TouchEvent) => {
      if (ev.touches.length !== 2 || !pinch) return
      ev.preventDefault()
      const r = el.getBoundingClientRect()
      const m = touchPairMetrics(ev.touches[0], ev.touches[1], r)
      const factor = m.dist / pinch.lastD
      const { w, h } = sizeRef.current
      setCamera((c) => {
        const c1 = zoomAtPoint(c, w, h, m.cx, m.cy, factor)
        return {
          ...c1,
          x: c1.x + (m.cx - pinch!.lastCx) / c1.zoom,
          y: c1.y + (m.cy - pinch!.lastCy) / c1.zoom,
        }
      })
      pinch = { lastD: m.dist, lastCx: m.cx, lastCy: m.cy }
    }

    const onTouchEnd = (ev: TouchEvent) => {
      if (ev.touches.length < 2) pinch = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  const MARQUEE_MIN = 4

  const onViewportPointerDown = (e: React.PointerEvent) => {
    const el = pointerEventTargetEl(e)
    if (!el) return
    const pointCardId = boardCardIdAtClientPoint(e.clientX, e.clientY)
    const nativePath =
      typeof e.nativeEvent.composedPath === 'function'
        ? e.nativeEvent.composedPath()
        : undefined
    if (pointCardId && !eventPathHitsBoardCard(nativePath)) {
      e.preventDefault()
      pushSelectionTrace('viewport.pointerdown', `fallback select ${pointCardId}`)
      flushSync(() => {
        setSelectedIds((prev) => {
          if (e.shiftKey) {
            if (prev.includes(pointCardId)) return prev.filter((id) => id !== pointCardId)
            return [...prev, pointCardId]
          }
          return [pointCardId]
        })
      })
      return
    }
    /** React 19 may deliver parent handlers before child stopPropagation runs — never steal card hits. */
    if (
      eventPathHitsBoardCard(nativePath) ||
      el.closest('.freeform-card') ||
      el.closest('[data-board-card]')
    ) {
      pushSelectionTrace('viewport.pointerdown', 'ignored card hit')
      return
    }
    /** Grid is pointer-events:none; empty canvas usually hits `.freeform-world` (not the viewport node). */
    const onBoard =
      el === e.currentTarget ||
      el.classList.contains('freeform-grid') ||
      el.classList.contains('freeform-world')
    if (!onBoard) {
      pushSelectionTrace('viewport.pointerdown', `ignored ${el.className || el.tagName.toLowerCase()}`)
      return
    }

    const immediatePan = e.button === 1 || (e.button === 0 && spaceDown.current)
    if (immediatePan) {
      e.preventDefault()
      pushSelectionTrace('viewport.pointerdown', 'pan start')
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      panRef.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY }
      setIsPanning(true)
      return
    }

    if (e.button === 0) {
      e.preventDefault()
      pushSelectionTrace('viewport.pointerdown', 'marquee armed')
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      const rect = viewportRef.current?.getBoundingClientRect()
      if (rect) {
        marqueePointerRef.current = {
          pointerId: e.pointerId,
          ox: e.clientX - rect.left,
          oy: e.clientY - rect.top,
        }
        setMarquee(null)
      }
    }
  }

  const onViewportPointerMove = (e: React.PointerEvent) => {
    if (panRef.current && panRef.current.pointerId === e.pointerId) {
      const dx = e.clientX - panRef.current.lastX
      const dy = e.clientY - panRef.current.lastY
      panRef.current.lastX = e.clientX
      panRef.current.lastY = e.clientY
      setCamera((c) => ({
        ...c,
        x: c.x - dx / c.zoom,
        y: c.y - dy / c.zoom,
      }))
      return
    }

    const mp = marqueePointerRef.current
    if (!mp || mp.pointerId !== e.pointerId) return
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const x0 = Math.min(mp.ox, x)
    const y0 = Math.min(mp.oy, y)
    const w = Math.abs(x - mp.ox)
    const h = Math.abs(y - mp.oy)
    if (w > 1 || h > 1) {
      setMarquee({ x: x0, y: y0, w, h })
    }
  }

  const endViewportPointer = (e: React.PointerEvent) => {
    const mp = marqueePointerRef.current
    if (mp && mp.pointerId === e.pointerId) {
      const rect = viewportRef.current?.getBoundingClientRect()
      if (rect) {
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const x0 = Math.min(mp.ox, x)
        const y0 = Math.min(mp.oy, y)
        const w = Math.abs(x - mp.ox)
        const h = Math.abs(y - mp.oy)
        if (w >= MARQUEE_MIN || h >= MARQUEE_MIN) {
          const { w: vw, h: vh } = sizeRef.current
          const cam = cameraRef.current
          const wr = marqueeViewportToWorldAabb(x0, y0, w, h, vw, vh, cam)
          const hits = cardsRef.current
            .filter((c) => worldRectsIntersect(cardWorldBounds(c), wr))
            .map((c) => c.id)
          pushSelectionTrace('marquee.complete', hits.length > 0 ? hits.join(', ') : 'no hits')
          flushSync(() => {
            if (hits.length > 0) {
              setSelectedIds((prev) =>
                e.shiftKey ? [...new Set([...prev, ...hits])] : hits,
              )
              return
            }
            if (!e.shiftKey) {
              setSelectedIds([])
            }
          })
        } else {
          if (!e.shiftKey) {
            pushSelectionTrace('marquee.clear', 'selection cleared')
            flushSync(() => {
              setSelectedIds([])
            })
          } else {
            pushSelectionTrace('marquee.preserve', 'kept selection')
          }
        }
      }
      setMarquee(null)
      marqueePointerRef.current = null
    }
    if (panRef.current?.pointerId === e.pointerId) {
      panRef.current = null
      setIsPanning(false)
    }
  }

  const spawnTerminalAt = useCallback((wx: number, wy: number) => {
    agentSummon.current += 1
    const n = agentSummon.current
    const id = newCardId()
    const w = 360
    const h = 320
    setCards((list) => [
      ...list,
      {
        id,
        x: wx - w / 2,
        y: wy - h / 2,
        width: w,
        height: h,
        title: `Terminal ${n}`,
        expanded: true,
        color: '#af52de',
        kind: 'agent',
        assignedToProblemId: null,
        parentAgentId: null,
        management: 'manual',
        agentRuntime: defaultTerminalRuntime(id, `Terminal ${n}`),
      },
    ])
    setSelectedIds([id])
    viewportRef.current?.focus()
    return id
  }, [])

  const spawnTerminalInView = useCallback(() => {
    spawnTerminalAt(camera.x, camera.y)
    setBoardNotice({ text: 'New terminal ready', tone: 'ok' })
  }, [camera.x, camera.y, spawnTerminalAt])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.key.toLowerCase() !== 't') return
      if (isTerminalTypingTarget(e.target)) return
      e.preventDefault()
      spawnTerminalInView()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [spawnTerminalInView])

  const resolveAgentAssignment = useCallback((agentId: string, fallbackProblemId: string | null = null) => {
    let handshakeProblemId: string | null = null
    setCards((list) => {
      const agent = list.find((c) => c.id === agentId && c.kind === 'agent')
      if (!agent) return list
      const prevPid = agent.assignedToProblemId ?? null
      const prevParent = agent.parentAgentId ?? null
      const problems = list.filter((c) => c.kind === 'problem')
      const wiresNow = wiresRef.current

      const cx = agent.x + agent.width / 2
      const cy = agent.y + cardDisplayHeight(agent) / 2
      const probHit = bestProblemOverlap(agent, problems)
      const parHit = bestParentAgentTarget(agent, list)

      const subSticky =
        !!prevParent &&
        (() => {
          const u = agentSubUnionBounds(prevParent, list)
          return !!(u && pointInBounds(cx, cy, expandBounds(u, ENVELOPE_STAY_SLACK)))
        })()

      const prevParentProblemId =
        prevParent
          ? (list.find((c) => c.id === prevParent && c.kind === 'agent')?.assignedToProblemId ?? null)
          : null

      let nextParent: string | null = null
      let nextPid: string | null = null

      const chooseFreshTarget = () => {
        const pArea = probHit?.area ?? 0
        const nArea = parHit?.area ?? 0
        if (pArea > 0) {
          if (nArea >= pArea && parHit) {
            nextParent = parHit.id
            const par = list.find((c) => c.id === parHit.id && c.kind === 'agent')
            nextPid = par?.assignedToProblemId ?? null
            return
          }
          nextParent = null
          nextPid = probHit!.id
          return
        }
        if (fallbackProblemId) {
          nextParent = null
          nextPid = fallbackProblemId
          return
        }
        if (nArea > 0 && parHit) {
          nextParent = parHit.id
          const par = list.find((c) => c.id === parHit.id && c.kind === 'agent')
          nextPid = par?.assignedToProblemId ?? null
          return
        }
        nextParent = null
        nextPid = null
      }

      if (
        subSticky &&
        prevParent &&
        (!fallbackProblemId || fallbackProblemId === prevParentProblemId)
      ) {
        nextParent = prevParent
        const par = list.find((c) => c.id === prevParent && c.kind === 'agent')
        nextPid = par?.assignedToProblemId ?? null
      } else if (prevPid && !prevParent) {
        const union = swarmUnionBounds(prevPid, list, wiresNow)
        const prevProblem = list.find((c) => c.id === prevPid && c.kind === 'problem')
        const prevSlack = prevProblem ? problemEnvelopeStaySlack(prevProblem) : ENVELOPE_STAY_SLACK
        if (
          union &&
          pointInBounds(cx, cy, expandBounds(union, prevSlack)) &&
          (!fallbackProblemId || fallbackProblemId === prevPid)
        ) {
          nextPid = prevPid
          nextParent = null
        } else {
          chooseFreshTarget()
        }
      } else {
        chooseFreshTarget()
      }

      if (prevPid === nextPid && prevParent === nextParent) {
        let next = list
        if (nextPid) next = reflowHubKanbanLayout(next, nextPid)
        if (nextParent) next = reflowSubagentLayout(next, nextParent)
        return next
      }

      let next = list.map((c) =>
        c.id === agentId && c.kind === 'agent'
          ? { ...c, assignedToProblemId: nextPid, parentAgentId: nextParent }
          : c,
      )
      const hubs = new Set<string>()
      if (prevPid) hubs.add(prevPid)
      if (nextPid) hubs.add(nextPid)
      const parents = new Set<string>()
      if (prevParent) parents.add(prevParent)
      if (nextParent) parents.add(nextParent)
      for (const hid of hubs) {
        next = reflowHubKanbanLayout(next, hid)
      }
      for (const pid of parents) {
        next = reflowSubagentLayout(next, pid)
      }
      if (prevPid !== nextPid && nextPid) {
        handshakeProblemId = nextPid
      }
      return next
    })
    if (handshakeProblemId) {
      fireConnectHandshake(agentId, handshakeProblemId)
    }
  }, [fireConnectHandshake])

  const onReleaseNod = useCallback((agentId: string, which: 'specialist' | 'lead') => {
    setCards((list) => applyReleaseNod(list, agentId, which).next)
  }, [])

  const resetBoardToPreset = useCallback(() => {
    if (handshakeTimerRef.current) {
      clearTimeout(handshakeTimerRef.current)
      handshakeTimerRef.current = null
    }
    setCards(hedgerowsDeltaSquadCards())
    setCamera({ x: 0, y: 0, zoom: 0.78 })
    setWires([])
    setSelectedIds([])
    setMarquee(null)
    setHandshakeFocus(null)
    agentSummon.current = hedgerowsPresetAgentCount()
  }, [])

  const applyImportedBoard = useCallback((parsed: PersistedBoardV1) => {
    if (handshakeTimerRef.current) {
      clearTimeout(handshakeTimerRef.current)
      handshakeTimerRef.current = null
    }
    setCamera(parsed.camera)
    setCards(parsed.cards)
    setWires(parsed.wires)
    setSelectedIds([])
    setMarquee(null)
    setHandshakeFocus(null)
    agentSummon.current = inferAgentSummonCount(parsed.cards)
    savePersistedBoard(parsed.camera, parsed.cards, parsed.wires)
  }, [])

  const exportBoardJson = useCallback(() => {
    const json = stringifyBoard(camera, cards, wires)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dewdrops-board-${new Date().toISOString().slice(0, 10)}.json`
    a.rel = 'noopener'
    a.click()
    URL.revokeObjectURL(url)
    setBoardNotice({ text: `Exported ${cards.length} cards`, tone: 'ok' })
  }, [camera, cards, wires])

  const onImportFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : null
        if (text === null) {
          setBoardNotice({ text: 'Could not read that file', tone: 'error' })
          return
        }
        const parsed = parseBoardJsonString(text)
        if (!parsed) {
          setBoardNotice({ text: 'Not a valid DewDrops board file (expected v1 JSON)', tone: 'error' })
          return
        }
        applyImportedBoard(parsed)
        setBoardNotice({ text: `Imported ${parsed.cards.length} cards`, tone: 'ok' })
      }
      reader.onerror = () => {
        setBoardNotice({ text: 'Could not read that file', tone: 'error' })
      }
      reader.readAsText(file, 'utf-8')
    },
    [applyImportedBoard],
  )

  useEffect(() => {
    if (!boardNotice) return
    const id = window.setTimeout(() => setBoardNotice(null), 5000)
    return () => window.clearTimeout(id)
  }, [boardNotice])

  const selectedProblems = useMemo(
    () =>
      selectedIds
        .map((id) => cards.find((card) => card.id === id && card.kind === 'problem'))
        .filter((card): card is WorkflowCard => !!card),
    [cards, selectedIds],
  )

  const selectedAgents = useMemo(
    () =>
      selectedIds
        .map((id) => cards.find((card) => card.id === id && card.kind === 'agent'))
        .filter((card): card is WorkflowCard => !!card),
    [cards, selectedIds],
  )

  const selectedAgent = useMemo(
    () => (selectedAgents.length === 1 ? selectedAgents[0] : null),
    [selectedAgents],
  )

  const selectedProblem = useMemo(() => {
    if (selectedProblems.length === 1) return selectedProblems[0]
    if (selectedProblems.length > 1) return null
    if (selectedIds.length === 0) return null

    const assignedProblemIds = [
      ...new Set(
        selectedAgents
          .map((agent) => agent.assignedToProblemId)
          .filter((problemId): problemId is string => !!problemId),
      ),
    ]

    if (assignedProblemIds.length === 1) {
      return problemCardById(cards, assignedProblemIds[0])
    }
    if (assignedProblemIds.length > 1) return null

    return problemCardById(cards, focusedProblemId)
  }, [cards, focusedProblemId, selectedAgents, selectedIds.length, selectedProblems])
  const lastFocusedProblemSelectionRef = useRef<string | null>(focusedProblemId ?? null)

  useEffect(() => {
    if (selectedProblem?.id) {
      onFocusedProblemChange?.(selectedProblem.id)
      return
    }
    if (selectedIds.length === 0 && !focusedProblemId) {
      onFocusedProblemChange?.(null)
    }
  }, [focusedProblemId, onFocusedProblemChange, selectedIds.length, selectedProblem?.id])

  useEffect(() => {
    if (!focusedProblemId) return
    const hasProblem = cards.some((card) => card.id === focusedProblemId && card.kind === 'problem')
    if (!hasProblem) return
    const focusChanged = lastFocusedProblemSelectionRef.current !== focusedProblemId
    lastFocusedProblemSelectionRef.current = focusedProblemId
    if (!focusChanged && selectedIds.length > 0) return
    setSelectedIds((prev) => (prev.length === 1 && prev[0] === focusedProblemId ? prev : [focusedProblemId]))
  }, [cards, focusedProblemId, selectedIds.length])

  const selectedProblemAgents = useMemo(
    () => (selectedProblem ? agentsInProblemSwarm(selectedProblem.id, cards, wires) : []),
    [cards, selectedProblem, wires],
  )

  const problemSessionMetaById = useMemo(() => {
    const next = new Map<
      string,
      {
        blueprint: ReturnType<typeof buildProblemSessionBlueprint>
        readiness: ReturnType<typeof buildProblemSessionReadiness>
        summary: ProblemSessionSummary
      }
    >()

    for (const card of cards) {
      if (card.kind !== 'problem') continue
      const blueprint = buildProblemSessionBlueprint(card, workspaceMode)
      const readiness = buildProblemSessionReadiness(card, {
        workspaceMode,
        agentCount: agentsInProblemSwarm(card.id, cards, wires).length,
        agentCards: agentsInProblemSwarm(card.id, cards, wires),
        bridgeHealth,
        blueprint,
      })

      next.set(card.id, {
        blueprint,
        readiness,
        summary: {
          workspaceLabel: blueprint.workspaceLabel,
          launchSurfaceLabel: blueprint.launchSurfaceLabel,
          memoryLabel: `${blueprint.memoryWing}/${blueprint.memoryRoom}`,
          anchorCount: blueprint.anchors.length,
          readinessLabel: readiness.label,
          readinessTone: readiness.tone,
        },
      })
    }

    return next
  }, [bridgeHealth, cards, wires, workspaceMode])

  const selectedProblemRoomWidth = selectedProblem
    ? Math.round(selectedProblem.problemBaseWidth ?? selectedProblem.width)
    : 280
  const selectedProblemRoomHeight = selectedProblem
    ? Math.round(selectedProblem.problemBaseHeight ?? selectedProblem.height)
    : 180
  const selectedProblemEnvelopePad = selectedProblem
    ? Math.round(problemEnvelopePad(selectedProblem))
    : DEFAULT_SWARM_ENVELOPE_PAD
  const selectedProblemAgentWidth = selectedProblem
    ? Math.round(selectedProblem.swarmAgentMinWidth ?? DEFAULT_KANBAN_MIN_AGENT_WIDTH)
    : DEFAULT_KANBAN_MIN_AGENT_WIDTH
  const selectedProblemBlueprint = useMemo(
    () =>
      selectedProblem
        ? (problemSessionMetaById.get(selectedProblem.id)?.blueprint ??
          buildProblemSessionBlueprint(selectedProblem, workspaceMode))
        : null,
    [problemSessionMetaById, selectedProblem, workspaceMode],
  )
  const selectedProblemReadiness = useMemo(
    () =>
      selectedProblem
        ? (problemSessionMetaById.get(selectedProblem.id)?.readiness ??
          buildProblemSessionReadiness(selectedProblem, {
            workspaceMode,
            agentCount: selectedProblemAgents.length,
            agentCards: selectedProblemAgents,
            bridgeHealth,
            blueprint: buildProblemSessionBlueprint(selectedProblem, workspaceMode),
          }))
        : null,
    [bridgeHealth, problemSessionMetaById, selectedProblem, selectedProblemAgents, workspaceMode],
  )
  const selectedProblemPaperclipCompanyId = selectedProblem?.paperclipCompanyId ?? ''
  const selectedProblemPaperclipProjectId = selectedProblem?.paperclipProjectId ?? ''
  const selectedProblemPaperclipAgentIds = useMemo(
    () => selectedProblem?.paperclipAgentIds ?? [],
    [selectedProblem?.paperclipAgentIds],
  )
  const selectedProblemPaperclipLeadAgentId = selectedProblem?.paperclipLeadAgentId ?? ''
  const selectedProblemRunLedger = selectedProblem?.runLedger ?? []
  const selectedProblemBriefSpec = useMemo(
    () => (selectedProblem ? editableProblemBriefSpec(selectedProblem) : null),
    [selectedProblem],
  )
  const activeTerminalCardId = selectedIds.length === 1 && selectedAgent ? selectedAgent.id : null
  const selectedProblemId = selectedProblem?.id ?? ''
  const selectedProblemBriefVersion = selectedProblem?.briefVersion ?? 0
  const selectedProblemCompartmentOptions = useMemo(
    () => (selectedProblem ? buildBriefCompartmentOptions(selectedProblem) : []),
    [selectedProblem],
  )

  const summonAgentBatch = useCallback((count = BULK_SUMMON_COUNT) => {
    const cardWidth = 176
    const cardHeight = 112
    const gapX = 28
    const gapY = 24
    const cols = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(count))))
    const totalWidth = cols * cardWidth + (cols - 1) * gapX
    const rows = Math.ceil(count / cols)
    const totalHeight = rows * cardHeight + (rows - 1) * gapY
    const anchorX = selectedProblem
      ? selectedProblem.x + selectedProblem.width / 2
      : cameraRef.current.x
    const startX = anchorX - totalWidth / 2
    const startY = selectedProblem
      ? selectedProblem.y + cardDisplayHeight(selectedProblem) + 72
      : cameraRef.current.y - totalHeight / 2

    const nextIds: string[] = []
    setCards((list) => {
      const next = [...list]
      for (let i = 0; i < count; i += 1) {
        agentSummon.current += 1
        const n = agentSummon.current
        const id = newCardId()
        const col = i % cols
        const row = Math.floor(i / cols)
        const staggerX = row % 2 === 0 ? 0 : Math.round((cardWidth + gapX) * 0.18)
        nextIds.push(id)
        next.push({
          id,
          x: startX + col * (cardWidth + gapX) + staggerX,
          y: startY + row * (cardHeight + gapY),
          width: cardWidth,
          height: cardHeight,
          title: `Terminal ${n}`,
          expanded: true,
          color: BULK_SUMMON_COLORS[(n - 1) % BULK_SUMMON_COLORS.length]!,
          kind: 'agent',
          assignedToProblemId: null,
          parentAgentId: null,
          management: 'manual',
          agentRuntime: defaultTerminalRuntime(id, `Terminal ${n}`),
        })
      }
      return next
    })
    setSelectedIds(nextIds)
    setBoardNotice({
      text: selectedProblem
        ? `Spun up ${count} terminals near “${selectedProblem.title}”`
        : `Spun up ${count} terminals near the current view`,
      tone: 'ok',
    })
  }, [selectedProblem])

  const selectedProblemDraftKey = useMemo(() => {
    if (!selectedProblem) return ''
    return [
      selectedProblem.id,
      selectedProblem.title,
      selectedProblem.mission ?? '',
      selectedProblem.swarmTemplate ?? '',
      selectedProblem.preferredLaunchSurface ?? '',
      selectedProblem.memoryWing ?? '',
      selectedProblem.memoryRoom ?? '',
      selectedProblem.memoryContextSummary ?? '',
      formatAnchorInput(selectedProblem.memoryAnchors),
      formatVisualMemoryPalaceDraft(buildVisualMemoryPalace(selectedProblem)),
      (selectedProblem.briefCompartmentAssets ?? [])
        .map((asset) => `${asset.id}:${asset.name}:${asset.compartmentLabel}:${asset.organizeStatus}`)
        .join('|'),
      selectedProblem.phoneRelayBrief ?? '',
      selectedProblem.desktopSessionBrief ?? '',
      (selectedProblem.openQuestions ?? []).join('|'),
      selectedProblemAgents
        .map((agent) => {
          const runtime = normalizeAgentRuntime(agent.agentRuntime, {
            cardId: agent.id,
            title: agent.title,
          })
          return [
            agent.id,
            agent.title,
            runtime.kind,
            runtime.profile,
            runtime.transport,
            runtime.instanceLabel,
            runtime.command ?? '',
            runtime.vpnAlias ?? '',
            runtime.workspaceRoot ?? '',
            runtime.sessionPolicy?.allowNetwork ? '1' : '0',
            runtime.sessionPolicy?.maxSteps ?? '',
            runtime.sessionPolicy?.maxRuntimeMs ?? '',
            (runtime.sessionPolicy?.writableRoots ?? []).join(','),
            (runtime.sessionPolicy?.requiresApprovalFor ?? []).join(','),
            runtime.sessionState?.status ?? '',
          ].join(':')
        })
        .join('|'),
      workspaceMode,
    ].join('::')
  }, [selectedProblem, selectedProblemAgents, workspaceMode])

  useEffect(() => {
    if (!selectedProblem) {
      setLaunchObjective('')
      return
    }
    const recipeTemplate = selectedProblem.swarmRecipeId
      ? getSwarmRecipe(selectedProblem.swarmRecipeId)?.template
      : undefined
    setLaunchTemplate(
      recipeTemplate ?? (selectedProblem.swarmTemplate as ButlerSwarmTemplate | undefined) ?? 'planning',
    )
    setLaunchObjective(buildProblemSwarmObjective(selectedProblem, cards, wires, workspaceMode))
  }, [cards, selectedProblem, selectedProblemDraftKey, wires, workspaceMode])

  const visibleRuns = useMemo(() => {
    if (selectedProblem?.butlerRoomId) {
      const roomRuns = recentRuns.filter((run) => run.room_id === selectedProblem.butlerRoomId)
      if (roomRuns.length > 0) return roomRuns
    }
    return recentRuns.slice(0, 6)
  }, [recentRuns, selectedProblem?.butlerRoomId])

  const latestProblemRunById = useMemo(() => {
    const next = new Map<string, ButlerSwarmRun>()
    for (const card of cards) {
      if (card.kind !== 'problem') continue
      const matched =
        (card.lastSwarmRunId
          ? recentRuns.find((run) => run.id === card.lastSwarmRunId || run.run_id === card.lastSwarmRunId)
          : undefined) ??
        (card.butlerRoomId ? recentRuns.find((run) => run.room_id === card.butlerRoomId) : undefined)
      if (matched) {
        next.set(card.id, matched)
      }
    }
    return next
  }, [cards, recentRuns])

  const latestAgentRunStateByCardId = useMemo(() => {
    const next = new Map<string, ButlerSwarmRunAgent>()
    for (const run of latestProblemRunById.values()) {
      for (const state of run.agent_states ?? []) {
        const mappedCardId =
          (typeof state.metadata?.dewdrops_card_id === 'string' ? state.metadata.dewdrops_card_id : '') ||
          state.agent_id
        if (mappedCardId) {
          next.set(mappedCardId, state)
        }
      }
    }
    return next
  }, [latestProblemRunById])

  useEffect(() => {
    if (!selectedProblem) {
      setCurrentRunId('')
      setCurrentRunReport(null)
      return
    }
    const preferredRunId =
      (selectedProblem.lastSwarmRunId &&
      visibleRuns.some(
        (run) =>
          run.id === selectedProblem.lastSwarmRunId || run.run_id === selectedProblem.lastSwarmRunId,
      )
        ? selectedProblem.lastSwarmRunId
        : '') ||
      visibleRuns[0]?.id ||
      visibleRuns[0]?.run_id ||
      ''

    setCurrentRunId((prev) => {
      if (prev && visibleRuns.some((run) => run.id === prev || run.run_id === prev)) {
        return prev
      }
      return preferredRunId
    })
  }, [selectedProblem, visibleRuns])

  useEffect(() => {
    if (!currentRunId) {
      setCurrentRunReportBusy(false)
      setCurrentRunReport(null)
      return
    }

    let cancelled = false
    setCurrentRunReportBusy(true)
    void getSwarmRunReport(bridgeSettings, currentRunId)
      .then((report) => {
        if (!cancelled) setCurrentRunReport(report)
      })
      .catch(() => {
        if (!cancelled) setCurrentRunReport(null)
      })
      .finally(() => {
        if (!cancelled) setCurrentRunReportBusy(false)
      })

    return () => {
      cancelled = true
    }
  }, [bridgeSettings, currentRunId])

  const syncSelectedProblemRunLedger = useCallback(
    (runs: readonly ButlerSwarmRun[], report: ButlerSwarmRunReport | null) => {
      if (!selectedProblem || selectedProblem.kind !== 'problem') return

      const matchedRuns = selectedProblem.butlerRoomId
        ? runs.filter((run) => run.room_id === selectedProblem.butlerRoomId)
        : selectedProblem.lastSwarmRunId
          ? runs.filter(
              (run) =>
                run.id === selectedProblem.lastSwarmRunId || run.run_id === selectedProblem.lastSwarmRunId,
            )
          : []

      if (matchedRuns.length === 0) return

      const orderedRuns = [...matchedRuns].reverse()
      setCards((list) => {
        let changed = false
        const next = list.map((card) => {
          if (card.id !== selectedProblem.id || card.kind !== 'problem') return card

          const briefPacket = buildProblemBriefPacket(card)
          let nextLedger = card.runLedger
          for (const run of orderedRuns) {
            const previousEntry =
              nextLedger?.find((entry) => entry.runId === run.run_id || entry.runId === run.id) ?? undefined
            nextLedger = upsertRunLedgerEntry(
              nextLedger,
              buildRunLedgerEntry(run, {
                report:
                  report && (report.run_id === run.run_id || report.run_id === run.id) ? report : undefined,
                briefPacket: briefPacket ?? undefined,
                briefSpecId: card.briefSpec?.id,
                capabilityProfileId: card.capabilityProfileId,
                swarmRecipeId: card.swarmRecipeId,
                existingEntry: previousEntry,
              }),
            )
          }

          if (JSON.stringify(nextLedger ?? []) === JSON.stringify(card.runLedger ?? [])) {
            return card
          }

          changed = true
          return {
            ...card,
            runLedger: nextLedger,
          }
        })

        return changed ? next : list
      })
    },
    [selectedProblem],
  )

  useEffect(() => {
    syncSelectedProblemRunLedger(recentRuns, currentRunReport)
  }, [currentRunReport, recentRuns, syncSelectedProblemRunLedger])

  const updateSelectedProblemCard = useCallback(
    (mutate: (problem: WorkflowCard) => WorkflowCard) => {
      if (!selectedProblem) return
      setCards((list) => {
        let changed = false
        let next = list.map((card) => {
          if (card.id !== selectedProblem.id || card.kind !== 'problem') return card
          changed = true
          return mutate(card)
        })
        if (!changed) return list
        next = reflowHubKanbanLayout(next, selectedProblem.id)
        return next
      })
    },
    [selectedProblem],
  )

  const updateAgentCardById = useCallback(
    (agentId: string, mutate: (agent: WorkflowCard) => WorkflowCard) => {
      setCards((list) => {
        let changed = false
        let touchedParentAgentId: string | null | undefined
        let touchedProblemId: string | null | undefined
        let next = list.map((card) => {
          if (card.id !== agentId || card.kind !== 'agent') return card
          const mutated = mutate(card)
          if (mutated !== card) changed = true
          touchedParentAgentId = mutated.parentAgentId
          touchedProblemId = mutated.assignedToProblemId
          return mutated
        })
        if (!changed) return list
        if (touchedParentAgentId) {
          next = reflowSubagentLayout(next, touchedParentAgentId)
        } else if (touchedProblemId) {
          next = reflowHubKanbanLayout(next, touchedProblemId)
        }
        return next
      })
    },
    [],
  )

  const updateAgentRuntimeById = useCallback(
    (agentId: string, patch: Partial<NonNullable<WorkflowCard['agentRuntime']>>) => {
      updateAgentCardById(agentId, (card) => {
        const current = card.agentRuntime ?? defaultTerminalRuntime(card.id, card.title)
        const nextProfile = patch.profile ?? current.profile
        const currentDefaultCommand = defaultCommandForRuntimeProfile(current.profile)
        const nextDefaultCommand = defaultCommandForRuntimeProfile(nextProfile)
        const nextCommand =
          patch.command !== undefined
            ? patch.command
            : !current.command || current.command === currentDefaultCommand
              ? nextDefaultCommand
              : current.command
        return {
          ...card,
          agentRuntime: {
            ...current,
            ...patch,
            kind: patch.kind ?? current.kind ?? 'terminal',
            transport: patch.transport ?? current.transport ?? 'cli',
            profile: nextProfile,
            command: nextCommand,
          },
        }
      })
    },
    [updateAgentCardById],
  )

  const updateAgentTitleById = useCallback(
    (agentId: string, title: string) => {
      updateAgentCardById(agentId, (agent) => {
        if (agent.title === title) return agent
        const currentRuntime = agent.agentRuntime
          ? normalizeAgentRuntime(agent.agentRuntime, { cardId: agent.id, title: agent.title })
          : undefined
        if (!currentRuntime) {
          return {
            ...agent,
            title,
          }
        }
        const currentDefaults = defaultTerminalRuntime(agent.id, agent.title)
        const nextDefaults = defaultTerminalRuntime(agent.id, title || agent.id)
        return {
          ...agent,
          title,
          agentRuntime: {
            ...currentRuntime,
            instanceLabel:
              currentRuntime.instanceLabel === currentDefaults.instanceLabel
                ? nextDefaults.instanceLabel
                : currentRuntime.instanceLabel,
            vpnAlias:
              currentRuntime.vpnAlias === currentDefaults.vpnAlias
                ? nextDefaults.vpnAlias
                : currentRuntime.vpnAlias,
          },
        }
      })
    },
    [updateAgentCardById],
  )

  const syncWorkerTerminalState = useCallback((agentId: string, runtimeState?: ReturnType<typeof workerTerminalStateFromSession>) => {
    if (!runtimeState) return
    updateAgentRuntimeById(agentId, {
      sessionState: runtimeState,
    })
  }, [updateAgentRuntimeById])

  const withWorkerTerminalBusy = useCallback(async (agentId: string, action: () => Promise<void>) => {
    setWorkerTerminalBusyIds((prev) => (prev.includes(agentId) ? prev : [...prev, agentId]))
    try {
      await action()
    } finally {
      setWorkerTerminalBusyIds((prev) => prev.filter((id) => id !== agentId))
    }
  }, [])

  const refreshWorkerTerminalAgent = useCallback(async (agentId: string) => {
    const agent = cardsRef.current.find((card) => card.kind === 'agent' && card.id === agentId)
    const runtime = agent?.agentRuntime ? normalizeAgentRuntime(agent.agentRuntime, { cardId: agent.id, title: agent.title }) : null
    const sessionId = runtime?.sessionState?.sessionId
    if (!sessionId) return
    await withWorkerTerminalBusy(agentId, async () => {
      try {
        const session = await getWorkerTerminalSession(sessionId)
        syncWorkerTerminalState(agentId, workerTerminalStateFromSession(session))
      } catch (error) {
        setBoardNotice({
          text: error instanceof Error ? error.message : 'Unable to refresh the worker terminal.',
          tone: 'error',
        })
      }
    })
  }, [syncWorkerTerminalState, withWorkerTerminalBusy])

  const startWorkerTerminalAgent = useCallback(async (agentId: string) => {
    const agent = cardsRef.current.find((card) => card.kind === 'agent' && card.id === agentId)
    if (!agent) return
    const runtime = normalizeAgentRuntime(agent.agentRuntime, { cardId: agent.id, title: agent.title })
    await withWorkerTerminalBusy(agentId, async () => {
      try {
        const session = await createWorkerTerminalSession({
          agentId: agent.id,
          title: agent.title,
          runtime,
          workspaceId: workspaceId ?? bootId,
          problemId: agent.assignedToProblemId ?? selectedProblemId,
        })
        syncWorkerTerminalState(agentId, workerTerminalStateFromSession(session))
        setBoardNotice({
          text: `Started ${agent.title}.`,
          tone: 'ok',
        })
      } catch (error) {
        updateAgentRuntimeById(agentId, {
          sessionState: {
            status: 'failed',
            currentTask: runtime.command,
            logTail: [
              ...(runtime.sessionState?.logTail ?? []),
              error instanceof Error ? `[stderr] ${error.message}` : `[stderr] Unable to start ${agent.title}.`,
            ],
          },
        })
        setBoardNotice({
          text: error instanceof Error ? error.message : `Unable to start ${agent.title}.`,
          tone: 'error',
        })
      }
    })
  }, [bootId, selectedProblemId, syncWorkerTerminalState, updateAgentRuntimeById, withWorkerTerminalBusy, workspaceId])

  const stopWorkerTerminalAgent = useCallback(async (agentId: string) => {
    const agent = cardsRef.current.find((card) => card.kind === 'agent' && card.id === agentId)
    const sessionId = agent?.agentRuntime?.sessionState?.sessionId
    if (!agent || !sessionId) return
    await withWorkerTerminalBusy(agentId, async () => {
      try {
        const session = await stopWorkerTerminalSession(sessionId)
        syncWorkerTerminalState(agentId, workerTerminalStateFromSession(session))
        setBoardNotice({
          text: `Stopped ${agent.title}.`,
          tone: 'ok',
        })
      } catch (error) {
        setBoardNotice({
          text: error instanceof Error ? error.message : `Unable to stop ${agent.title}.`,
          tone: 'error',
        })
      }
    })
  }, [syncWorkerTerminalState, withWorkerTerminalBusy])

  const sendWorkerTerminalInput = useCallback(async (agentId: string, input: string) => {
    const agent = cardsRef.current.find((card) => card.kind === 'agent' && card.id === agentId)
    const sessionId = agent?.agentRuntime?.sessionState?.sessionId
    if (!agent || !sessionId || input.length === 0) return
    try {
      const session = await sendWorkerTerminalSessionInput(sessionId, input)
      syncWorkerTerminalState(agentId, workerTerminalStateFromSession(session))
    } catch (error) {
      setBoardNotice({
        text: error instanceof Error ? error.message : `Unable to send input to ${agent.title}.`,
        tone: 'error',
      })
    }
  }, [syncWorkerTerminalState])

  const resizeWorkerTerminalAgent = useCallback(async (
    agentId: string,
    sessionId: string,
    cols: number,
    rows: number,
  ) => {
    try {
      const session = await resizeWorkerTerminalSession(sessionId, cols, rows)
      syncWorkerTerminalState(agentId, workerTerminalStateFromSession(session))
    } catch {
      // Ignore resize jitter failures while the session boots or the card is still settling.
    }
  }, [syncWorkerTerminalState])

  useEffect(() => {
    if (isJsdomRuntime) return
    const agentsToBoot = cards
      .filter((card): card is WorkflowCard => card.kind === 'agent')
      .filter((agent) => {
        if (workerTerminalBusyIds.includes(agent.id)) return false
        const runtime = normalizeAgentRuntime(agent.agentRuntime, { cardId: agent.id, title: agent.title })
        const status = runtime.sessionState?.status
        if (runtime.sessionState?.sessionId) return false
        return !status || status === 'idle'
      })

    if (agentsToBoot.length === 0) return
    for (const agent of agentsToBoot) {
      void startWorkerTerminalAgent(agent.id)
    }
  }, [cards, isJsdomRuntime, startWorkerTerminalAgent, workerTerminalBusyIds])

  useEffect(() => {
    if (isJsdomRuntime || !selectedProblem || selectedProblemAgents.length === 0) return
    let cancelled = false

    const syncSessions = async () => {
      try {
        const sessions = await listWorkerTerminalSessions({
          workspaceId: workspaceId ?? bootId,
          problemId: selectedProblem.id,
        })
        if (cancelled) return
        const latestByAgentId = new Map<string, (typeof sessions)[number]>()
        for (const session of sessions) {
          if (!session.agentId || latestByAgentId.has(session.agentId)) continue
          latestByAgentId.set(session.agentId, session)
        }
        for (const agent of selectedProblemAgents) {
          const session = latestByAgentId.get(agent.id)
          if (!session) continue
          syncWorkerTerminalState(agent.id, workerTerminalStateFromSession(session))
        }
      } catch {
        // Polling failures should not interrupt local editing.
      }
    }

    void syncSessions()
    const timer = window.setInterval(() => {
      void syncSessions()
    }, 2500)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [bootId, isJsdomRuntime, selectedProblem, selectedProblemAgents, syncWorkerTerminalState, workspaceId])

  useEffect(() => {
    if (isJsdomRuntime || !selectedAgent?.agentRuntime?.sessionState?.sessionId) return
    let cancelled = false

    const syncSession = async () => {
      try {
        const session = await getWorkerTerminalSession(selectedAgent.agentRuntime!.sessionState!.sessionId!)
        if (cancelled) return
        syncWorkerTerminalState(selectedAgent.id, workerTerminalStateFromSession(session))
      } catch {
        // Leave the current state alone if the session cannot be reached.
      }
    }

    void syncSession()
    const timer = window.setInterval(() => {
      void syncSession()
    }, 350)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [isJsdomRuntime, selectedAgent, syncWorkerTerminalState])

  const updateProblemCardById = useCallback(
    (problemId: string, mutate: (problem: WorkflowCard) => WorkflowCard) => {
      setCards((list) => {
        let changed = false
        let next = list.map((card) => {
          if (card.id !== problemId || card.kind !== 'problem') return card
          const mutated = mutate(card)
          if (mutated !== card) changed = true
          return mutated
        })
        if (!changed) return list
        next = reflowHubKanbanLayout(next, problemId)
        return next
      })
    },
    [],
  )

  const updateProblemBriefCard = useCallback(
    (problemId: string, briefSpec: WorkflowCard['briefSpec']) => {
      updateProblemCardById(problemId, (problem) =>
        bumpBriefVersion(
          syncCapabilityPack(
            syncProblemBriefBindings({
              ...problem,
              briefSpec,
            }),
          ),
        ),
      )
    },
    [updateProblemCardById],
  )

  const setSelectedProblemTemplate = useCallback(
    (template: ButlerSwarmTemplate) => {
      setLaunchTemplate(template)
      updateSelectedProblemCard((problem) =>
        syncCapabilityPack({
          ...problem,
          swarmTemplate: template,
        }),
      )
    },
    [updateSelectedProblemCard],
  )

  const addSelectedProblemCompartmentFiles = useCallback(
    (files: File[]) => {
      if (!selectedProblem || files.length === 0) return
      updateSelectedProblemCard((problem) => {
        const compartmentOptions = buildBriefCompartmentOptions(problem)
        const nextAssets = files.map((file) =>
          createBriefCompartmentAsset(problem, file, {
            compartmentOptions,
          }),
        )
        return {
          ...problem,
          briefCompartmentAssets: [...(problem.briefCompartmentAssets ?? []), ...nextAssets],
        }
      })
      setBoardNotice({
        text: `Indexed ${files.length} file${files.length === 1 ? '' : 's'} into ${selectedProblem.title}`,
        tone: 'ok',
      })
    },
    [selectedProblem, updateSelectedProblemCard],
  )

  const moveSelectedProblemCompartmentAsset = useCallback(
    (assetId: string, compartmentId: string) => {
      updateSelectedProblemCard((problem) => {
        const compartmentOptions = buildBriefCompartmentOptions(problem)
        const targetCompartment = compartmentOptions.find((option) => option.id === compartmentId)
        if (!targetCompartment) return problem
        const nextAssets = (problem.briefCompartmentAssets ?? []).map((asset) => {
          if (asset.id !== assetId) return asset
          return {
            ...asset,
            compartmentId: targetCompartment.id,
            compartmentLabel: targetCompartment.label,
            compartmentKind: targetCompartment.kind,
            anchorRef: targetCompartment.anchorRef,
            matchedLocusId: targetCompartment.locusId,
            organizeStatus: 'sorted' as const,
            organizeReason: `Moved into ${targetCompartment.label} by the operator.`,
          }
        })
        return {
          ...problem,
          briefCompartmentAssets: nextAssets,
        }
      })
    },
    [updateSelectedProblemCard],
  )

  const removeSelectedProblemCompartmentAsset = useCallback(
    (assetId: string) => {
      updateSelectedProblemCard((problem) => {
        const nextAssets = (problem.briefCompartmentAssets ?? []).filter((asset) => asset.id !== assetId)
        return {
          ...problem,
          briefCompartmentAssets: nextAssets.length > 0 ? nextAssets : undefined,
        }
      })
    },
    [updateSelectedProblemCard],
  )

  const selectedProblemLaunchBrief = useMemo(() => {
    if (!selectedProblem || !selectedProblemBlueprint || !launchObjective.trim()) return ''
    return [
      selectedProblem.title.trim(),
      `Template: ${launchTemplate}`,
      ...(selectedProblem.paperclipCompanyId
        ? [
            `Paperclip company: ${selectedProblem.paperclipCompanyId}`,
            ...(selectedProblem.paperclipProjectId
              ? [`Paperclip project: ${selectedProblem.paperclipProjectId}`]
              : []),
            ...(selectedProblem.paperclipLeadAgentId
              ? [`Paperclip lead: ${selectedProblem.paperclipLeadAgentId}`]
              : []),
          ]
        : []),
      '',
      'Objective:',
      launchObjective.trim(),
      '',
      'Handoff packet:',
      selectedProblemBlueprint.handoffText,
    ].join('\n')
  }, [launchObjective, launchTemplate, selectedProblem, selectedProblemBlueprint])

  const copyInspectorText = useCallback(async (label: string, text: string) => {
    if (!text.trim()) {
      setBoardNotice({ text: `No ${label} is available yet.`, tone: 'error' })
      return
    }

    try {
      await copyTextToClipboard(text)
      setBoardNotice({ text: `Copied ${label}.`, tone: 'ok' })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Could not copy ${label} from this browser session`
      setBoardNotice({ text: message, tone: 'error' })
    }
  }, [])

  const refreshRuns = useCallback(
    async (quiet = false) => {
      try {
        const runs = await listSwarmRuns(bridgeSettings, { limit: 12 })
        setRecentRuns(runs)
      } catch (error) {
        if (!quiet) {
          const message = error instanceof Error ? error.message : 'Could not load Butler swarm runs'
          setBoardNotice({ text: message, tone: 'error' })
        }
      }
    },
    [bridgeSettings],
  )

  const refreshBridgeState = useCallback(
    async (quiet = false) => {
      setBridgeBusy(true)
      try {
        const health = await getButlerBridgeHealth(bridgeSettings)
        setBridgeHealth(health)
        await refreshRuns(true)
        if (!quiet) {
          setBoardNotice({
            text: `Butler bridge online at ${bridgeSettings.url}`,
            tone: 'ok',
          })
        }
      } catch (error) {
        setBridgeHealth(null)
        if (!quiet) {
          const message = error instanceof Error ? error.message : 'Could not reach Butler bridge'
          setBoardNotice({ text: message, tone: 'error' })
        }
      } finally {
        setBridgeBusy(false)
      }
    },
    [bridgeSettings, refreshRuns],
  )

  const pairLocalBridgeAction = useCallback(async () => {
    setBridgeBusy(true)
    try {
      const nextSettings = await pairLocalBridge(bridgeSettings)
      setBridgeSettings(nextSettings)
      const health = await getButlerBridgeHealth(nextSettings)
      setBridgeHealth(health)
      await refreshRuns(true)
      setBoardNotice({
        text: `Paired local Butler bridge at ${nextSettings.url}`,
        tone: 'ok',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not pair with local Butler bridge'
      setBoardNotice({ text: message, tone: 'error' })
    } finally {
      setBridgeBusy(false)
    }
  }, [bridgeSettings, refreshRuns])

  const refreshPaperclipState = useCallback(
    async (quiet = false, companyIdOverride?: string) => {
      setPaperclipBusy(true)
      try {
        const companies = await listPaperclipCompanies(paperclipSettings)
        setPaperclipCompanies(companies)
        const nextCompanyId =
          companyIdOverride?.trim() ||
          selectedProblemPaperclipCompanyId ||
          companies[0]?.id ||
          ''

        if (nextCompanyId) {
          const [projects, agents] = await Promise.all([
            listPaperclipProjects(paperclipSettings, nextCompanyId),
            listPaperclipAgents(paperclipSettings, nextCompanyId),
          ])
          setPaperclipProjects(projects)
          setPaperclipAgents(agents)
        } else {
          setPaperclipProjects([])
          setPaperclipAgents([])
        }

        setPaperclipOnline(true)
        if (!quiet) {
          setBoardNotice({
            text:
              companies.length > 0
                ? `Paperclip online at ${paperclipSettings.url}`
                : `Paperclip responded at ${paperclipSettings.url}, but no companies were returned`,
            tone: 'ok',
          })
        }
      } catch (error) {
        setPaperclipOnline(false)
        setPaperclipCompanies([])
        setPaperclipProjects([])
        setPaperclipAgents([])
        if (!quiet) {
          const message = error instanceof Error ? error.message : 'Could not reach Paperclip'
          setBoardNotice({ text: message, tone: 'error' })
        }
      } finally {
        setPaperclipBusy(false)
      }
    },
    [paperclipSettings, selectedProblemPaperclipCompanyId],
  )

  const launchSelectedProblemPaperclip = useCallback(async () => {
    if (!selectedProblem) {
      setBoardNotice({ text: 'Select exactly one problem card to launch into Paperclip.', tone: 'error' })
      return
    }
    if (!selectedProblemPaperclipCompanyId) {
      setBoardNotice({ text: 'Choose a Paperclip company for this problem room first.', tone: 'error' })
      return
    }
    if (!launchObjective.trim()) {
      setBoardNotice({ text: 'Swarm objective is empty.', tone: 'error' })
      return
    }

    const targetAgentIds =
      selectedProblemPaperclipAgentIds.length > 0
        ? selectedProblemPaperclipAgentIds
        : selectedProblemPaperclipLeadAgentId
          ? [selectedProblemPaperclipLeadAgentId]
          : []
    const targetAgents = paperclipAgents.filter((agent) => targetAgentIds.includes(agent.id))
    const mentionTokens = targetAgents.map((agent) => `@${agent.name}`)
    const executionWorkspaceMode = executionWorkspaceModeForRecipe(selectedProblem.swarmRecipeId)

    setPaperclipLaunchBusy(true)
    try {
      const issue = await createPaperclipIssue(paperclipSettings, {
        companyId: selectedProblemPaperclipCompanyId,
        projectId: selectedProblemPaperclipProjectId || undefined,
        assigneeAgentId: selectedProblemPaperclipLeadAgentId || targetAgentIds[0] || undefined,
        title: selectedProblem.title.trim(),
        description: selectedProblemLaunchBrief || launchObjective.trim(),
        executionWorkspaceSettings: executionWorkspaceMode ? { mode: executionWorkspaceMode } : undefined,
      })

      await upsertPaperclipIssueDocument(paperclipSettings, issue.id, {
        key: 'plan',
        title: 'DewDrops launch packet',
        body: selectedProblemLaunchBrief || launchObjective.trim(),
      })

      if (mentionTokens.length > 0) {
        await addPaperclipIssueComment(
          paperclipSettings,
          issue.id,
          [
            `${mentionTokens.join(' ')} DewDrops launched this room into Paperclip.`,
            '',
            `Issue: ${issue.identifier ?? issue.id}`,
            '',
            'Objective:',
            launchObjective.trim(),
          ].join('\n'),
        )
      }

      let leadRunId = ''
      for (const agentId of targetAgentIds) {
        const run = await invokePaperclipAgent(paperclipSettings, agentId)
        if (!leadRunId) leadRunId = run.runId
      }

      updateSelectedProblemCard((problem) => ({
        ...problem,
        lastPaperclipIssueId: issue.id,
        lastPaperclipRunId: leadRunId || problem.lastPaperclipRunId,
      }))

      setBoardNotice({
        text:
          targetAgentIds.length > 0
            ? `Paperclip issue ${issue.identifier ?? issue.id} launched for “${selectedProblem.title}”`
            : `Paperclip issue ${issue.identifier ?? issue.id} created for “${selectedProblem.title}”`,
        tone: 'ok',
      })
    } catch (error) {
      const message =
        error instanceof PaperclipBridgeError || error instanceof Error
          ? error.message
          : 'Could not launch Paperclip swarm'
      setBoardNotice({ text: message, tone: 'error' })
    } finally {
      setPaperclipLaunchBusy(false)
    }
  }, [
    launchObjective,
    paperclipAgents,
    paperclipSettings,
    selectedProblem,
    selectedProblemLaunchBrief,
    selectedProblemPaperclipAgentIds,
    selectedProblemPaperclipCompanyId,
    selectedProblemPaperclipLeadAgentId,
    selectedProblemPaperclipProjectId,
    updateSelectedProblemCard,
  ])

  const syncPaperclipArtifactReview = useCallback(
    async (runId: string, artifactId: string, status: ArtifactStatus) => {
      const issueId = selectedProblem?.lastPaperclipIssueId?.trim()
      if (!issueId) return

      const externalId = `${runId}:${artifactId}`
      const workProducts = await listPaperclipIssueWorkProducts(paperclipSettings, issueId)
      const workProduct = workProducts.find((entry) => entry.externalId === externalId)

      if (!workProduct) {
        setBoardNotice({
          text: `Stored ${status} locally. No Paperclip work product matched ${externalId}.`,
          tone: 'error',
        })
        return
      }

      await updatePaperclipWorkProduct(paperclipSettings, workProduct.id, {
        status: paperclipStatusForArtifactStatus(status),
        reviewState: paperclipReviewStateForArtifactStatus(status),
        metadata: {
          ...(workProduct.metadata ?? {}),
          artifactStatus: status,
        },
      })

      setBoardNotice({
        text: `Marked ${workProduct.title} as ${status} in DewDrops and Paperclip.`,
        tone: 'ok',
      })
    },
    [paperclipSettings, selectedProblem?.lastPaperclipIssueId],
  )

  const launchSelectedProblemSwarm = useCallback(async () => {
    if (!selectedProblem) {
      setBoardNotice({ text: 'Select exactly one problem card to launch a Butler swarm.', tone: 'error' })
      return
    }
    if (!launchObjective.trim()) {
      setBoardNotice({ text: 'Swarm objective is empty.', tone: 'error' })
      return
    }

    setLaunchBusy(true)
    try {
      const problemForLaunch = syncProblemBriefBindings(selectedProblem)
      const blueprint = buildProblemSessionBlueprint(problemForLaunch, workspaceMode)
      const briefPacket = buildProblemBriefPacket(problemForLaunch)
      const launchMetadata = buildProblemLaunchMetadata(problemForLaunch)
      let nextSettings = bridgeSettings
      const isLocalBridge = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(bridgeSettings.url.trim())
      if (!nextSettings.token.trim() && isLocalBridge) {
        nextSettings = await pairLocalBridge(bridgeSettings)
        setBridgeSettings(nextSettings)
      }

      const contract = await createSwarmContract(nextSettings, {
        title: selectedProblem.title,
        objective: launchObjective.trim(),
        template: launchTemplate,
        capability_profile_id: blueprint.capabilityProfileId,
        swarm_recipe_id: blueprint.swarmRecipeId,
        rtk_basis: {
          ...blueprint.rtkBasis,
          brief_version: briefPacket?.briefVersion ?? blueprint.rtkBasis.brief_version,
          brief_hash: briefPacket?.briefHash,
        },
        handoff_packet: blueprint.handoffText,
        briefPacket: briefPacket ?? undefined,
        agents: buildSwarmContractAgents(
          problemForLaunch,
          selectedProblemAgents,
          launchTemplate,
          launchObjective.trim(),
          workspaceMode,
        ),
        room_id: selectedProblem.butlerRoomId,
        room_kind: launchMetadata.roomKind,
        target: blueprint.target,
        launcher: blueprint.launcher,
        metadata: {
          ...launchMetadata.metadata,
          dewdrops_problem_id: selectedProblem.id,
          selected_agent_count: selectedProblemAgents.length,
          selected_agent_ids: selectedProblemAgents.map((agent) => agent.id),
          workspace_mode: blueprint.workspaceMode,
          launch_surface: blueprint.launchSurface,
          capability_profile_id: blueprint.capabilityProfileId,
          swarm_recipe_id: blueprint.swarmRecipeId,
          rtk_basis: {
            ...blueprint.rtkBasis,
            brief_version: briefPacket?.briefVersion ?? blueprint.rtkBasis.brief_version,
            brief_hash: briefPacket?.briefHash,
          },
          rtk_handoff_lines: blueprint.handoffLines.length,
          rtk_handoff_chars: blueprint.handoffText.length,
          brief_version: briefPacket?.briefVersion,
          brief_hash: briefPacket?.briefHash,
          memory_wing: blueprint.memoryWing,
          memory_room: blueprint.memoryRoom,
          handoff_packet: blueprint.handoffText,
          paperclip_company_id: selectedProblem.paperclipCompanyId,
          paperclip_project_id: selectedProblem.paperclipProjectId,
          paperclip_agent_ids: selectedProblem.paperclipAgentIds ?? [],
          paperclip_lead_agent_id: selectedProblem.paperclipLeadAgentId,
        },
        source_refs: blueprint.sourceRefs,
        created_by: 'dewdrops',
      })
      const launched = await launchSwarmContract(nextSettings, contract.id)
      const runId = launched.run?.id ?? launched.run?.run_id ?? ''
      if (runId) {
        setCurrentRunId(runId)
      }

      setCards((list) =>
        list.map((card) =>
          card.id === selectedProblem.id
            ? {
                ...card,
                butlerRoomId: contract.room_id,
                lastSwarmContractId: contract.id,
                lastSwarmRunId: runId || card.lastSwarmRunId,
                swarmTemplate: launchTemplate,
              }
            : card,
        ),
      )
      await refreshRuns(true)
      setBoardNotice({
        text: `Launched Butler swarm for “${selectedProblem.title}”`,
        tone: 'ok',
      })
    } catch (error) {
      const message =
        error instanceof ButlerBridgeError || error instanceof Error
          ? error.message
          : 'Could not launch Butler swarm'
      setBoardNotice({ text: message, tone: 'error' })
    } finally {
      setLaunchBusy(false)
    }
  }, [bridgeSettings, launchObjective, launchTemplate, refreshRuns, selectedProblem, selectedProblemAgents, workspaceMode])

  const stopCurrentSwarmRun = useCallback(async () => {
    if (!currentRunId) {
      setBoardNotice({ text: 'Select a run before stopping it.', tone: 'error' })
      return
    }

    setStopBusy(true)
    try {
      await stopSwarmRun(bridgeSettings, currentRunId)
      await refreshRuns(true)
      setBoardNotice({ text: `Stopped swarm run ${currentRunId.slice(-6)}`, tone: 'ok' })
    } catch (error) {
      const message =
        error instanceof ButlerBridgeError || error instanceof Error
          ? error.message
          : 'Could not stop Butler swarm'
      setBoardNotice({ text: message, tone: 'error' })
    } finally {
      setStopBusy(false)
    }
  }, [bridgeSettings, currentRunId, refreshRuns])

  useEffect(() => {
    void refreshBridgeState(true)
  }, [refreshBridgeState])

  useEffect(() => {
    if (!toolbarPanelOpen) return
    void refreshPaperclipState(true, selectedProblemPaperclipCompanyId)
  }, [refreshPaperclipState, selectedProblemPaperclipCompanyId, toolbarPanelOpen])

  useEffect(() => {
    if (!recentRuns.some((run) => swarmRunIsActive(run.status))) return
    const id = window.setInterval(() => {
      void refreshRuns(true)
    }, 4000)
    return () => window.clearInterval(id)
  }, [recentRuns, refreshRuns])

  const onViewportDoubleClick = (e: React.MouseEvent) => {
    const el = pointerEventTargetEl(e)
    if (el?.closest('.freeform-card')) return
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const { x, y } = screenToWorld(sx, sy)
    spawnTerminalAt(x, y)
  }

  const worldTransform = `translate(${size.w / 2}px, ${size.h / 2}px) scale(${camera.zoom}) translate(${-camera.x}px, ${-camera.y}px)`

  const totalOpenQuestionCount = useMemo(
    () =>
      cards.reduce((acc, c) => acc + openQuestionsForCard(c, cards, wires).length, 0),
    [cards, wires],
  )

  const engagedAgentCount = useMemo(
    () => cards.filter((c) => c.kind === 'agent' && !!c.assignedToProblemId).length,
    [cards],
  )

  const availableAgentCount = useMemo(
    () => cards.filter((c) => c.kind === 'agent' && !c.assignedToProblemId && !c.parentAgentId).length,
    [cards],
  )

  const moveCardSelection = useCallback(
    (cardId: string, nx: number, ny: number) => {
      setCards((list) => {
        const cur = list.find((x) => x.id === cardId)
        if (!cur) return list

        const clearDraggedAssignments = (
          nextCards: WorkflowCard[],
          movingIds: ReadonlySet<string>,
        ): WorkflowCard[] => {
          const detachedProblemIds = new Set<string>()
          const detachedParentIds = new Set<string>()
          const detachIds = new Set<string>()
          for (const item of nextCards) {
            if (item.kind !== 'agent' || !movingIds.has(item.id)) continue
            if (
              shouldDraggedAgentStayAttached(
                item,
                item.x,
                item.y,
                nextCards,
                wiresRef.current,
                movingIds,
              )
            ) {
              continue
            }
            if (item.assignedToProblemId) detachedProblemIds.add(item.assignedToProblemId)
            if (item.parentAgentId) detachedParentIds.add(item.parentAgentId)
            detachIds.add(item.id)
          }
          if (detachIds.size === 0) return nextCards

          let detached = nextCards.map((item) =>
            item.kind === 'agent' && detachIds.has(item.id)
              ? {
                  ...item,
                  assignedToProblemId: null,
                  parentAgentId: null,
                  releaseNodFromLead: false,
                  releaseNodFromSpecialist: false,
                }
              : item,
          )
          for (const problemId of detachedProblemIds) {
            detached = reflowHubKanbanLayout(detached, problemId)
          }
          for (const parentId of detachedParentIds) {
            detached = reflowSubagentLayout(detached, parentId)
          }
          return detached
        }

        const draggingSelection = selectedIds.length > 1 && selectedIds.includes(cardId)
        if (draggingSelection) {
          const dx = nx - cur.x
          const dy = ny - cur.y
          if (dx === 0 && dy === 0) return list
          const movingIds = new Set(selectedIds)
          const moved = list.map((item) =>
            movingIds.has(item.id)
              ? { ...item, x: item.x + dx, y: item.y + dy }
              : item,
          )
          return clearDraggedAssignments(moved, movingIds)
        }

        if (cur.kind !== 'agent') {
          return list.map((x) => (x.id === cardId ? { ...x, x: nx, y: ny } : x))
        }
        const inSwarm = !!(cur.assignedToProblemId || cur.parentAgentId)
        if (!inSwarm) {
          return list.map((x) => (x.id === cardId ? { ...x, x: nx, y: ny } : x))
        }
        const movingIds = new Set([cardId])
        if (
          !shouldDraggedAgentStayAttached(cur, nx, ny, list, wiresRef.current, movingIds)
        ) {
          let detached = list.map((item) =>
            item.id === cardId && item.kind === 'agent'
              ? {
                  ...item,
                  x: nx,
                  y: ny,
                  assignedToProblemId: null,
                  parentAgentId: null,
                  releaseNodFromLead: false,
                  releaseNodFromSpecialist: false,
                }
              : item,
          )
          if (cur.parentAgentId) {
            detached = reflowSubagentLayout(detached, cur.parentAgentId)
          }
          if (cur.assignedToProblemId) {
            detached = reflowHubKanbanLayout(detached, cur.assignedToProblemId)
          }
          return detached
        }
        let anchor: WorkflowCard | undefined
        let siblings: WorkflowCard[]
        if (cur.parentAgentId) {
          anchor = list.find((p) => p.id === cur.parentAgentId && p.kind === 'agent')
          siblings = list.filter(
            (a) =>
              a.kind === 'agent' &&
              a.parentAgentId === cur.parentAgentId &&
              a.id !== cardId,
          )
        } else if (cur.assignedToProblemId) {
          const pid = cur.assignedToProblemId
          anchor = list.find((p) => p.id === pid && p.kind === 'problem')
          siblings = list.filter(
            (a) =>
              a.kind === 'agent' &&
              a.assignedToProblemId === pid &&
              !a.parentAgentId &&
              a.id !== cardId,
          )
        } else {
          return list.map((x) => (x.id === cardId ? { ...x, x: nx, y: ny } : x))
        }
        if (!anchor) {
          return list.map((x) => (x.id === cardId ? { ...x, x: nx, y: ny } : x))
        }
        const { x, y } = magneticKanbanDockPosition(nx, ny, cur, anchor, siblings)
        return list.map((x0) => (x0.id === cardId ? { ...x0, x, y } : x0))
      })
    },
    [selectedIds],
  )

  const finishCardDrag = useCallback(
    (cardId: string) => {
      const draggedIds =
        selectedIds.length > 1 && selectedIds.includes(cardId) ? selectedIds : [cardId]
      const fallbackProblemId =
        draggedIds.length > 1
          ? (bestGroupProblemTarget(new Set(draggedIds), cardsRef.current)?.id ?? null)
          : null
      for (const draggedId of draggedIds) {
        const dragged = cardsRef.current.find((card) => card.id === draggedId)
        if (dragged?.kind === 'agent') {
          resolveAgentAssignment(draggedId, fallbackProblemId)
        }
      }
    },
    [resolveAgentAssignment, selectedIds],
  )

  return (
    <div className={`freeform-root freeform-root--${workspaceMode}`}>
      <header className="freeform-toolbar freeform-toolbar--minimal">
        <div className="freeform-toolbar-meta">
          <h1>DewDrops</h1>
          <p>
            {workspaceName ? `${workspaceName} • ` : ''}
            Click `New terminal` or press `T` to spin one up instantly. Double-click empty space also works.
          </p>
        </div>
        <div className="freeform-toolbar-actions">
          {workspaceOptions.length > 0 && workspaceId ? (
            <label className="freeform-workspace-picker">
              <span>Workspace</span>
              <select
                value={workspaceId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  onWorkspaceChange?.(e.target.value)
                }}
              >
                {workspaceOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {onCreateWorkspace ? (
            <button
              type="button"
              className={`freeform-btn freeform-btn--tool${presetPickerOpen ? ' is-active' : ''}`}
              title="Create a new workspace from a preset"
              onClick={() => setPresetPickerOpen((prev) => !prev)}
            >
              New workspace
            </button>
          ) : null}
          {onDuplicateWorkspace ? (
            <button
              type="button"
              className="freeform-btn freeform-btn--tool"
              title="Duplicate the current workspace"
              onClick={() => {
                onDuplicateWorkspace()
              }}
            >
              Duplicate
            </button>
          ) : null}
          {onRenameWorkspace ? (
            <button
              type="button"
              className="freeform-btn freeform-btn--tool"
              title="Rename the current workspace"
              onClick={() => {
                const nextName = window.prompt('Rename workspace', workspaceName ?? '')
                if (nextName !== null) {
                  onRenameWorkspace(nextName)
                }
              }}
            >
              Rename
            </button>
          ) : null}
          {onDeleteWorkspace && workspaceOptions.length > 1 ? (
            <button
              type="button"
              className="freeform-btn freeform-btn--tool"
              title="Delete the current workspace"
              onClick={() => {
                if (window.confirm(`Delete workspace “${workspaceName ?? 'Current workspace'}”?`)) {
                  onDeleteWorkspace()
                }
              }}
            >
              Delete
            </button>
          ) : null}
          {onOpenWorldShell ? (
            <button
              type="button"
              className="freeform-btn freeform-btn--tool"
              title="Open the focused workspace in the World OS shell"
              onClick={() => {
                onOpenWorldShell(selectedProblem?.id ?? null)
              }}
            >
              World shell
            </button>
          ) : null}
          {onOpenPhoneRelay ? (
            <button
              type="button"
              className="freeform-btn freeform-btn--tool"
              title="Open the focused workspace in the phone relay shell"
              onClick={() => {
                onOpenPhoneRelay(selectedProblem?.id ?? null)
              }}
            >
              Phone relay
            </button>
          ) : null}
          <div className="freeform-toolbar-mode-group" aria-label="Workspace mode">
            {WORKSPACE_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`freeform-btn freeform-btn--tool${workspaceMode === option.value ? ' is-active' : ''}`}
                title={option.detail}
                onClick={() => {
                  setWorkspaceMode(option.value)
                }}
              >
                {option.value === 'desktop' ? 'Desktop' : option.value === 'phone' ? 'Phone' : 'Palace'}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`freeform-btn freeform-btn--tool${toolbarPanelOpen ? ' is-active' : ''}`}
            title="Show or hide the Butler dock"
            onClick={() => {
              setToolbarPanelOpen((prev) => !prev)
            }}
          >
            {toolbarPanelOpen ? 'Hide dock' : 'Show dock'}
          </button>
          <button
            type="button"
            className="freeform-btn freeform-btn--tool is-active"
            title="Spin up a terminal at the center of the current view"
            onClick={() => {
              spawnTerminalInView()
            }}
          >
            New terminal
          </button>
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            title="Select and move cards — drag on empty canvas to marquee"
            onClick={() => {
              viewportRef.current?.focus()
            }}
          >
            Select
          </button>
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            title="Spin up a batch of terminals near the selected problem or current view"
            onClick={() => {
              summonAgentBatch()
            }}
          >
            Spin up {BULK_SUMMON_COUNT}
          </button>
          <button
            type="button"
            className={`freeform-btn freeform-btn--tool${traceEnabled ? ' is-active' : ''}`}
            title="Show live selection event trace in the Butler panel"
            onClick={() => {
              setTraceEnabled((prev) => !prev)
            }}
          >
            Trace
          </button>
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            title="Restore the Hedgerows preset and clear saved board data from this browser"
            onClick={resetBoardToPreset}
          >
            Reset hub
          </button>
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            title="Download the current board as JSON (backup, git, or share)"
            onClick={exportBoardJson}
          >
            Export
          </button>
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            title="Load a board from a DewDrops JSON file"
            onClick={() => importFileRef.current?.click()}
          >
            Import
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept=".json,application/json"
            className="freeform-sr-only"
            aria-label="Import board JSON file"
            onChange={onImportFileChange}
          />
        </div>
        <div className="freeform-toolbar-status" aria-label="Board status">
          <span>{engagedAgentCount} engaged</span>
          <span>{availableAgentCount} available</span>
          <span>{totalOpenQuestionCount} open</span>
        </div>
        {boardNotice ? (
          <p
            className={`freeform-toolbar-notice${boardNotice.tone === 'error' ? ' freeform-toolbar-notice--error' : ''}`}
            role="status"
            aria-live="polite"
          >
            {boardNotice.text}
          </p>
        ) : null}
      </header>

      <div
        ref={viewportRef}
        className={`freeform-viewport${isPanning ? ' is-panning' : ''}${spaceHeld ? ' is-space-down' : ''}`}
        tabIndex={0}
        onWheel={onWheel}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={endViewportPointer}
        onPointerCancel={endViewportPointer}
        onDoubleClick={onViewportDoubleClick}
      >
        {presetPickerOpen && onCreateWorkspace ? (
          <PresetPicker
            presets={workspacePresets}
            onSelect={(presetId) => {
              setPresetPickerOpen(false)
              onCreateWorkspace(presetId)
            }}
            onDismiss={() => setPresetPickerOpen(false)}
          />
        ) : null}
        {toolbarPanelOpen ? (
          <div className="freeform-toolbar-panel-wrap">
            <section className="freeform-toolbar-panel" aria-label="Butler swarm launcher">
              <div className="freeform-toolbar-panel-header">
                <div>
                  <h2>Butler bridge</h2>
                  <p>Launch a real swarm from one selected problem bubble.</p>
                </div>
                <div className="freeform-toolbar-panel-status">
                  <span
                    className={`freeform-run-pill${bridgeHealth?.ok ? ' is-online' : ' is-offline'}`}
                  >
                    {bridgeBusy ? 'checking' : bridgeHealth?.ok ? 'online' : 'offline'}
                  </span>
                  {bridgeHealth?.service ? <span>{bridgeHealth.service}</span> : null}
                  {bridgeHealth?.version ? <span>v{bridgeHealth.version}</span> : null}
                </div>
              </div>

              <div className="freeform-toolbar-panel-grid">
                <div className="freeform-toolbar-panel-section">
                  <p className="freeform-toolbar-panel-hint">
                    Launching stays room-first. Infrastructure wiring is tucked away unless you need to pair or troubleshoot the bridge.
                  </p>
                  <details className="freeform-toolbar-panel-disclosure">
                    <summary>Infrastructure settings</summary>
                    <div className="freeform-toolbar-panel-disclosure-body">
                      <label className="freeform-field">
                        <span>Bridge URL</span>
                        <input
                          type="url"
                          value={bridgeSettings.url}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            persistBridgeSettings({ ...bridgeSettings, url: e.target.value })
                          }}
                          placeholder="http://127.0.0.1:8765"
                        />
                      </label>
                      <label className="freeform-field">
                        <span>Token</span>
                        <input
                          type="password"
                          value={bridgeSettings.token}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            persistBridgeSettings({ ...bridgeSettings, token: e.target.value })
                          }}
                          placeholder="Optional on localhost"
                        />
                      </label>
                      <div className="freeform-toolbar-panel-actions">
                        <button
                          type="button"
                          className="freeform-btn freeform-btn--tool"
                          onClick={() => {
                            void pairLocalBridgeAction()
                          }}
                          disabled={bridgeBusy}
                        >
                          {bridgeBusy ? 'Pairing…' : 'Pair local'}
                        </button>
                        <button
                          type="button"
                          className="freeform-btn freeform-btn--tool"
                          onClick={() => {
                            void refreshBridgeState(false)
                          }}
                          disabled={bridgeBusy}
                        >
                          Check bridge
                        </button>
                        <button
                          type="button"
                          className="freeform-btn freeform-btn--tool"
                          onClick={() => {
                            void refreshRuns(false)
                          }}
                          disabled={bridgeBusy}
                        >
                          Refresh runs
                        </button>
                      </div>
                      <p className="freeform-toolbar-panel-hint">
                        Localhost browser calls can use the local Butler bridge without a manual token.
                      </p>
                    </div>
                  </details>
                </div>

                <div className="freeform-toolbar-panel-section">
                  <div className="freeform-toolbar-panel-problem">
                    <div>
                      <h3>Paperclip control plane</h3>
                      <p>Create a Paperclip issue, write the DewDrops packet into the plan doc, and wake the selected agents.</p>
                    </div>
                    <span className={`freeform-run-pill${paperclipOnline ? ' is-online' : ' is-offline'}`}>
                      {paperclipBusy ? 'syncing' : paperclipOnline ? 'online' : 'offline'}
                    </span>
                  </div>

                  <p className="freeform-toolbar-panel-hint">
                    Keep the room and swarm choices in front; only open infrastructure settings when you need to wire or resync the control plane.
                  </p>
                  <details className="freeform-toolbar-panel-disclosure">
                    <summary>Infrastructure settings</summary>
                    <div className="freeform-toolbar-panel-disclosure-body">
                      <label className="freeform-field">
                        <span>Paperclip URL</span>
                        <input
                          type="url"
                          value={paperclipSettings.url}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            persistPaperclipSettings({ ...paperclipSettings, url: e.target.value })
                          }}
                          placeholder="http://127.0.0.1:3100"
                        />
                      </label>

                      <label className="freeform-field">
                        <span>Token</span>
                        <input
                          type="password"
                          value={paperclipSettings.token}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            persistPaperclipSettings({ ...paperclipSettings, token: e.target.value })
                          }}
                          placeholder="Optional in local trusted mode"
                        />
                      </label>

                      <div className="freeform-toolbar-panel-actions">
                        <button
                          type="button"
                          className="freeform-btn freeform-btn--tool"
                          onClick={() => {
                            void refreshPaperclipState(false, selectedProblemPaperclipCompanyId)
                          }}
                          disabled={paperclipBusy}
                        >
                          Sync Paperclip
                        </button>
                      </div>
                    </div>
                  </details>

                  <div className="freeform-toolbar-panel-form-row">
                    <label className="freeform-field">
                      <span>Company</span>
                      <select
                        value={selectedProblemPaperclipCompanyId}
                        disabled={!selectedProblem || paperclipBusy}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                          if (!selectedProblem) return
                          const nextCompanyId = e.target.value.trim()
                          updateSelectedProblemCard((problem) => ({
                            ...problem,
                            paperclipCompanyId: nextCompanyId || undefined,
                            paperclipProjectId: undefined,
                            paperclipAgentIds: undefined,
                            paperclipLeadAgentId: undefined,
                          }))
                          void refreshPaperclipState(true, nextCompanyId)
                        }}
                      >
                        <option value="">Select company</option>
                        {paperclipCompanies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="freeform-field">
                      <span>Project</span>
                      <select
                        value={selectedProblemPaperclipProjectId}
                        disabled={!selectedProblem || !selectedProblemPaperclipCompanyId || paperclipBusy}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                          if (!selectedProblem) return
                          const nextProjectId = e.target.value.trim()
                          updateSelectedProblemCard((problem) => ({
                            ...problem,
                            paperclipProjectId: nextProjectId || undefined,
                          }))
                        }}
                      >
                        <option value="">No project</option>
                        {paperclipProjects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="freeform-field">
                    <span>Lead agent</span>
                    <select
                      value={selectedProblemPaperclipLeadAgentId}
                      disabled={!selectedProblem || !selectedProblemPaperclipCompanyId || paperclipBusy}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        if (!selectedProblem) return
                        const nextLeadAgentId = e.target.value.trim()
                        updateSelectedProblemCard((problem) => {
                          const currentAgentIds = problem.paperclipAgentIds ?? []
                          const nextAgentIds =
                            nextLeadAgentId && !currentAgentIds.includes(nextLeadAgentId)
                              ? [...currentAgentIds, nextLeadAgentId]
                              : currentAgentIds
                          return {
                            ...problem,
                            paperclipLeadAgentId: nextLeadAgentId || undefined,
                            paperclipAgentIds: nextAgentIds.length > 0 ? nextAgentIds : undefined,
                          }
                        })
                      }}
                    >
                      <option value="">No lead selected</option>
                      {paperclipAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="freeform-field">
                    <span>Swarm agents</span>
                    {paperclipAgents.length > 0 ? (
                      <div className="freeform-paperclip-agent-list">
                        {paperclipAgents.map((agent) => {
                          const checked = selectedProblemPaperclipAgentIds.includes(agent.id)
                          const detail =
                            agent.title ||
                            agent.role ||
                            (agent.adapterType ? agent.adapterType.replace(/_/g, ' ') : '') ||
                            'Paperclip agent'
                          return (
                            <label
                              key={agent.id}
                              className={`freeform-paperclip-agent-row${checked ? ' is-selected' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!selectedProblem || paperclipBusy}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                  if (!selectedProblem) return
                                  const nextChecked = e.target.checked
                                  updateSelectedProblemCard((problem) => {
                                    const currentAgentIds = problem.paperclipAgentIds ?? []
                                    const nextAgentIds = nextChecked
                                      ? [...new Set([...currentAgentIds, agent.id])]
                                      : currentAgentIds.filter((id) => id !== agent.id)
                                    const nextLeadAgentId =
                                      problem.paperclipLeadAgentId === agent.id && !nextChecked
                                        ? nextAgentIds[0]
                                        : problem.paperclipLeadAgentId || nextAgentIds[0]
                                    return {
                                      ...problem,
                                      paperclipAgentIds: nextAgentIds.length > 0 ? nextAgentIds : undefined,
                                      paperclipLeadAgentId: nextLeadAgentId || undefined,
                                    }
                                  })
                                }}
                              />
                              <div>
                                <strong>{agent.name}</strong>
                                <span>{detail}</span>
                              </div>
                              {selectedProblemPaperclipLeadAgentId === agent.id ? (
                                <span className="freeform-run-pill is-active">lead</span>
                              ) : null}
                            </label>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="freeform-toolbar-panel-hint">
                        {selectedProblemPaperclipCompanyId
                          ? 'No agents returned for this Paperclip company.'
                          : 'Select a Paperclip company to load its agents.'}
                      </p>
                    )}
                  </div>

                  <div className="freeform-toolbar-panel-actions">
                    <button
                      type="button"
                      className="freeform-btn freeform-btn--tool is-active"
                      onClick={() => {
                        void launchSelectedProblemPaperclip()
                      }}
                      disabled={!selectedProblem || paperclipLaunchBusy || paperclipBusy}
                    >
                      {paperclipLaunchBusy ? 'Launching…' : 'Launch to Paperclip'}
                    </button>
                  </div>

                  <p className="freeform-toolbar-panel-hint">
                    Paperclip is the local swarm control plane here. DewDrops creates the issue, writes the plan, then wakes the selected Paperclip agents.
                  </p>
                  {selectedProblem?.lastPaperclipIssueId ? (
                    <p className="freeform-toolbar-panel-hint">
                      Last issue {selectedProblem.lastPaperclipIssueId}
                      {selectedProblem.lastPaperclipRunId ? ` • last run ${selectedProblem.lastPaperclipRunId}` : ''}
                    </p>
                  ) : null}
                </div>

                <div className="freeform-toolbar-panel-section">
                  <div className="freeform-toolbar-panel-problem">
                    <div>
                      <h3>{selectedProblem ? selectedProblem.title : 'No problem selected'}</h3>
                      <p>
                        {selectedProblem
                          ? `${selectedProblemAgents.length} agent${selectedProblemAgents.length === 1 ? '' : 's'} in the swarm envelope`
                          : 'Select exactly one problem bubble to launch a swarm.'}
                      </p>
                    </div>
                    {selectedProblem?.lastSwarmRunId ? (
                      <span className="freeform-run-pill">
                        Last run {selectedProblem.lastSwarmRunId.slice(-6)}
                      </span>
                    ) : null}
                  </div>

                  <div className="freeform-toolbar-panel-form-row">
                    <label className="freeform-field">
                      <span>Template</span>
                      <select
                        value={launchTemplate}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                          setSelectedProblemTemplate(e.target.value as ButlerSwarmTemplate)
                        }
                        disabled={!selectedProblem || launchBusy}
                      >
                        {SWARM_TEMPLATE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="freeform-toolbar-panel-form-row">
                    <label className="freeform-field">
                      <span>Room width</span>
                      <input
                        type="number"
                        min={160}
                        max={720}
                        step={10}
                        value={selectedProblemRoomWidth}
                        disabled={!selectedProblem}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          if (!selectedProblem) return
                          const nextWidth = clampNumber(
                            e.target.valueAsNumber || selectedProblemRoomWidth,
                            160,
                            720,
                          )
                          updateSelectedProblemCard((problem) => ({
                            ...problem,
                            width: nextWidth,
                            problemBaseWidth: nextWidth,
                          }))
                        }}
                      />
                    </label>
                    <label className="freeform-field">
                      <span>Room height</span>
                      <input
                        type="number"
                        min={100}
                        max={520}
                        step={10}
                        value={selectedProblemRoomHeight}
                        disabled={!selectedProblem}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          if (!selectedProblem) return
                          const nextHeight = clampNumber(
                            e.target.valueAsNumber || selectedProblemRoomHeight,
                            100,
                            520,
                          )
                          updateSelectedProblemCard((problem) => ({
                            ...problem,
                            height: nextHeight,
                            problemBaseHeight: nextHeight,
                          }))
                        }}
                      />
                    </label>
                  </div>

                  <div className="freeform-toolbar-panel-form-row">
                    <label className="freeform-field">
                      <span>Membrane pad</span>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        step={4}
                        value={selectedProblemEnvelopePad}
                        disabled={!selectedProblem}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          if (!selectedProblem) return
                          const nextPad = clampNumber(
                            e.target.valueAsNumber || selectedProblemEnvelopePad,
                            0,
                            120,
                          )
                          updateSelectedProblemCard((problem) => ({
                            ...problem,
                            swarmEnvelopePad: nextPad,
                          }))
                        }}
                      />
                    </label>
                    <label className="freeform-field">
                      <span>Card width</span>
                      <input
                        type="number"
                        min={96}
                        max={260}
                        step={8}
                        value={selectedProblemAgentWidth}
                        disabled={!selectedProblem}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          if (!selectedProblem) return
                          const nextWidth = clampNumber(
                            e.target.valueAsNumber || selectedProblemAgentWidth,
                            96,
                            260,
                          )
                          updateSelectedProblemCard((problem) => ({
                            ...problem,
                            swarmAgentMinWidth: nextWidth,
                          }))
                        }}
                      />
                    </label>
                  </div>

                  <label className="freeform-field">
                    <span>Objective</span>
                    <textarea
                      value={launchObjective}
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setLaunchObjective(e.target.value)}
                      placeholder="Describe what this swarm should do."
                      disabled={!selectedProblem || launchBusy}
                      rows={5}
                    />
                  </label>

                  <div className="freeform-toolbar-panel-actions">
                    <button
                      type="button"
                      className="freeform-btn freeform-btn--tool is-active"
                      onClick={() => {
                        void launchSelectedProblemSwarm()
                      }}
                      disabled={!selectedProblem || launchBusy}
                    >
                      {launchBusy ? 'Launching…' : 'Launch swarm'}
                    </button>
                  </div>
                </div>

                <div className="freeform-toolbar-panel-section">
                  <div className="freeform-toolbar-panel-problem">
                    <div>
                      <h3>{selectedProblem?.butlerRoomId ? 'Room runs' : 'Recent runs'}</h3>
                      <p>
                        {selectedProblem?.butlerRoomId
                          ? 'Runs attached to the selected problem room.'
                          : 'Latest runs seen by the Butler bridge.'}
                      </p>
                    </div>
                  </div>

                  {visibleRuns.length > 0 ? (
                    <SwarmRunList
                      runs={visibleRuns}
                      currentRunId={currentRunId || selectedProblem?.lastSwarmRunId}
                      onSelectRun={setCurrentRunId}
                    />
                  ) : (
                    <p className="freeform-toolbar-panel-hint">No swarm runs yet.</p>
                  )}
                </div>

                {traceEnabled ? (
                  <div className="freeform-toolbar-panel-section">
                    <div className="freeform-toolbar-panel-problem">
                      <div>
                        <h3>Selection trace</h3>
                        <p>Live pointer and selection events from this browser session.</p>
                      </div>
                      <span className="freeform-run-pill">{selectedIds.length} selected</span>
                    </div>
                    {selectionTrace.length > 0 ? (
                      <ul className="freeform-trace-list">
                        {selectionTrace.map((entry) => (
                          <li key={entry.id} className="freeform-trace-item">
                            <strong>{entry.label}</strong>
                            <span>{entry.detail}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="freeform-toolbar-panel-hint">No events traced yet.</p>
                    )}
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
        {marquee ? (
          <div className="freeform-marquee-layer" aria-hidden>
            <div
              className="freeform-marquee-rect"
              style={{
                left: marquee.x,
                top: marquee.y,
                width: marquee.w,
                height: marquee.h,
              }}
            />
          </div>
        ) : null}
        <div className="freeform-world" style={{ transform: worldTransform }}>
          <div className="freeform-grid" aria-hidden />
          <SwarmEnvelopeLayer cards={cards} wires={wires} />
          {cards.map((c) => (
            <WorkflowCardView
              key={c.id}
              card={c}
              cards={cards}
              wires={wires}
              handshakeFocus={handshakeFocus}
              selected={selectedIds.includes(c.id)}
              activeTerminal={activeTerminalCardId === c.id}
              camera={camera}
              problemSessionSummary={c.kind === 'problem' ? problemSessionMetaById.get(c.id)?.summary : undefined}
              problemRunStatus={c.kind === 'problem' ? latestProblemRunById.get(c.id)?.status : undefined}
              problemRunSummary={c.kind === 'problem' ? latestProblemRunById.get(c.id)?.summary : undefined}
              problemRunId={
                c.kind === 'problem'
                  ? latestProblemRunById.get(c.id)?.run_id || latestProblemRunById.get(c.id)?.id
                  : undefined
              }
              agentRunStatus={c.kind === 'agent' ? latestAgentRunStateByCardId.get(c.id)?.status : undefined}
              agentRunSummary={
                c.kind === 'agent' ? latestAgentRunStateByCardId.get(c.id)?.result_summary : undefined
              }
              agentTerminalBusy={workerTerminalBusyIds.includes(c.id)}
              onSelect={(shiftKey) =>
                flushSync(() => {
                  setSelectedIds((prev) => {
                    if (shiftKey) {
                      if (prev.includes(c.id)) return prev.filter((x) => x !== c.id)
                      return [...prev, c.id]
                    }
                    return [c.id]
                  })
                })
              }
              onMove={(nx, ny) => moveCardSelection(c.id, nx, ny)}
              onResize={(nw, nh) =>
                setCards((list) => {
                  const cur = list.find((x) => x.id === c.id)
                  if (!cur) return list
                  if (cur.kind === 'problem') {
                    let next = list.map((x) =>
                      x.id === c.id
                        ? {
                            ...x,
                            width: nw,
                            height: nh,
                            problemBaseWidth: nw,
                            problemBaseHeight: nh,
                          }
                        : x,
                    )
                    next = reflowHubKanbanLayout(next, c.id)
                    return next
                  }
                  if (cur.kind === 'agent') {
                    let next = list.map((x) =>
                      x.id === c.id ? { ...x, width: nw, height: nh } : x,
                    )
                    const ag = next.find((x) => x.id === c.id && x.kind === 'agent')
                    if (ag?.parentAgentId) {
                      next = reflowSubagentLayout(next, ag.parentAgentId)
                    } else if (ag?.assignedToProblemId) {
                      next = reflowHubKanbanLayout(next, ag.assignedToProblemId)
                    }
                    return next
                  }
                  return list.map((x) => (x.id === c.id ? { ...x, width: nw, height: nh } : x))
                })
              }
              onDragEnd={() => {
                finishCardDrag(c.id)
              }}
              onToggleExpand={() =>
                setCards((list) => {
                  let next = list.map((x) => (x.id === c.id ? { ...x, expanded: !x.expanded } : x))
                  const card = next.find((x) => x.id === c.id)
                  if (card?.kind === 'agent') {
                    if (card.parentAgentId) {
                      next = reflowSubagentLayout(next, card.parentAgentId)
                    } else if (card.assignedToProblemId) {
                      next = reflowHubKanbanLayout(next, card.assignedToProblemId)
                    }
                  }
                  if (card?.kind === 'problem') {
                    next = reflowHubKanbanLayout(next, card.id)
                  }
                  return next
                })
              }
              onProblemBriefChange={updateProblemBriefCard}
              onAgentTerminalStart={startWorkerTerminalAgent}
              onAgentTerminalStop={stopWorkerTerminalAgent}
              onAgentTerminalRefresh={refreshWorkerTerminalAgent}
              onAgentTerminalSendInput={sendWorkerTerminalInput}
              onAgentTerminalResize={resizeWorkerTerminalAgent}
              onReleaseNod={onReleaseNod}
              onMarkUserMovingCard={() => {
                const movingIds =
                  selectedIds.length > 1 && selectedIds.includes(c.id) ? selectedIds : [c.id]
                for (const movingId of movingIds) {
                  markUserMovingCard(movingId)
                }
              }}
              onCardPointerSession={beginCardPointerSession}
              onTrace={pushSelectionTrace}
            />
          ))}
        </div>
        {selectedProblem ? (
          <ProblemSwarmInspector
            title={selectedProblem.title}
            agentCount={selectedProblemAgents.length}
            roomId={selectedProblem.butlerRoomId}
            lastRunId={selectedProblem.lastSwarmRunId}
            bridgeHealth={bridgeHealth}
            workspaceMode={workspaceMode}
            workspaceOptions={WORKSPACE_MODE_OPTIONS}
            launchSurface={selectedProblemBlueprint!.launchSurface}
            capabilityPackId={resolveCapabilityPackId(selectedProblem) ?? ''}
            capabilityPackOptions={CAPABILITY_PACK_OPTIONS}
            capabilityProfileId={selectedProblem.capabilityProfileId ?? ''}
            capabilityProfileOptions={CAPABILITY_PROFILE_OPTIONS}
            swarmRecipeId={selectedProblem.swarmRecipeId ?? ''}
            swarmRecipeOptions={SWARM_RECIPE_OPTIONS}
            briefSpec={selectedProblemBriefSpec!}
            briefVersion={selectedProblemBriefVersion}
            launchSurfaceOptions={LAUNCH_SURFACE_OPTIONS}
            template={launchTemplate}
            templateOptions={SWARM_TEMPLATE_OPTIONS}
            objective={launchObjective}
            roomWidth={selectedProblemRoomWidth}
            roomHeight={selectedProblemRoomHeight}
            membranePad={selectedProblemEnvelopePad}
            cardWidth={selectedProblemAgentWidth}
            memoryWing={selectedProblem.memoryWing ?? ''}
            memoryWingPlaceholder={selectedProblemBlueprint!.memoryWing}
            memoryRoom={selectedProblem.memoryRoom ?? ''}
            memoryRoomPlaceholder={selectedProblemBlueprint!.memoryRoom}
            memorySummary={selectedProblem.memoryContextSummary ?? ''}
            memorySummaryPlaceholder={selectedProblemBlueprint!.contextSummary}
            memoryAnchors={formatAnchorInput(selectedProblem.memoryAnchors)}
            memoryPalaceDraft={formatVisualMemoryPalaceDraft(buildVisualMemoryPalace(selectedProblem))}
            memoryPalaceLoci={selectedProblemBlueprint!.visualLoci}
            briefCompartmentAssets={selectedProblem.briefCompartmentAssets ?? []}
            briefCompartmentOptions={selectedProblemCompartmentOptions}
            selectedAgent={selectedAgent}
            workerAgents={selectedProblemAgents}
            onWorkerTerminalTitleChange={updateAgentTitleById}
            onWorkerTerminalRuntimeChange={updateAgentRuntimeById}
            onWorkerTerminalStart={startWorkerTerminalAgent}
            onWorkerTerminalStop={stopWorkerTerminalAgent}
            onWorkerTerminalRefresh={refreshWorkerTerminalAgent}
            onWorkerTerminalSendInput={sendWorkerTerminalInput}
            workerTerminalBusyIds={workerTerminalBusyIds}
            phoneBrief={selectedProblem.phoneRelayBrief ?? ''}
            desktopBrief={selectedProblem.desktopSessionBrief ?? ''}
            readinessTone={selectedProblemReadiness!.tone}
            readinessLabel={selectedProblemReadiness!.label}
            readinessSummary={selectedProblemReadiness!.summary}
            readinessItems={selectedProblemReadiness!.items}
            handoffLines={selectedProblemBlueprint!.handoffLines}
            handoffText={selectedProblemBlueprint!.handoffText}
            runs={visibleRuns}
            runLedger={selectedProblemRunLedger}
            currentRunId={currentRunId}
            currentRunReport={currentRunReport}
            reportBusy={currentRunReportBusy}
            launchBusy={launchBusy}
            stopBusy={stopBusy}
            onWorkspaceModeChange={setWorkspaceMode}
            onLaunchSurfaceChange={(value) => {
              updateSelectedProblemCard((problem) =>
                syncCapabilityPack({
                  ...problem,
                  preferredLaunchSurface: value,
                }),
              )
            }}
            onCapabilityPackChange={(value) => {
              const pack = value.trim() ? getCapabilityPack(value.trim()) : undefined
              if (!pack) {
                updateSelectedProblemCard((problem) => ({
                  ...problem,
                  capabilityPackId: undefined,
                }))
                return
              }
              setLaunchTemplate(pack.template)
              updateSelectedProblemCard((problem) =>
                syncProblemBriefBindings(applyCapabilityPack(problem, pack)),
              )
            }}
            onCapabilityProfileChange={(value) => {
              const capabilityProfileId = value.trim() || undefined
              updateSelectedProblemCard((problem) =>
                syncCapabilityPack(
                  syncProblemBriefBindings({
                    ...problem,
                    capabilityProfileId,
                  }),
                ),
              )
            }}
            onSwarmRecipeChange={(value) => {
              const recipe = value.trim() ? getSwarmRecipe(value.trim()) : undefined
              if (recipe) {
                setLaunchTemplate(recipe.template)
              }
              updateSelectedProblemCard((problem) =>
                syncCapabilityPack(
                  syncProblemBriefBindings({
                    ...problem,
                    swarmRecipeId: value.trim() || undefined,
                    swarmTemplate: recipe?.template ?? problem.swarmTemplate,
                  }),
                ),
              )
            }}
            onBriefChange={(value) => {
              if (!selectedProblem) return
              updateProblemBriefCard(selectedProblem.id, value)
            }}
            onTemplateChange={setSelectedProblemTemplate}
            onObjectiveChange={setLaunchObjective}
            onRoomWidthChange={(value) => {
              const nextWidth = clampNumber(value, 160, 720)
              updateSelectedProblemCard((problem) => ({
                ...problem,
                width: nextWidth,
                problemBaseWidth: nextWidth,
              }))
            }}
            onRoomHeightChange={(value) => {
              const nextHeight = clampNumber(value, 100, 520)
              updateSelectedProblemCard((problem) => ({
                ...problem,
                height: nextHeight,
                problemBaseHeight: nextHeight,
              }))
            }}
            onMembranePadChange={(value) => {
              const nextPad = clampNumber(value, 0, 120)
              updateSelectedProblemCard((problem) => ({
                ...problem,
                swarmEnvelopePad: nextPad,
              }))
            }}
            onCardWidthChange={(value) => {
              const nextWidth = clampNumber(value, 96, 260)
              updateSelectedProblemCard((problem) => ({
                ...problem,
                swarmAgentMinWidth: nextWidth,
              }))
            }}
            onMemoryWingChange={(value) => {
              updateSelectedProblemCard((problem) => ({
                ...problem,
                memoryWing: value.trim() || undefined,
              }))
            }}
            onMemoryRoomChange={(value) => {
              updateSelectedProblemCard((problem) => ({
                ...problem,
                memoryRoom: value.trim() || undefined,
              }))
            }}
            onMemorySummaryChange={(value) => {
              updateSelectedProblemCard((problem) => ({
                ...problem,
                memoryContextSummary: value.trim() || undefined,
              }))
            }}
            onMemoryAnchorsChange={(value) => {
              const anchors = parseAnchorInput(value)
              updateSelectedProblemCard((problem) => ({
                ...problem,
                memoryAnchors: anchors.length > 0 ? anchors : undefined,
              }))
            }}
            onMemoryPalaceDraftChange={(value) => {
              const loci = parseVisualMemoryPalaceDraft(value)
              updateSelectedProblemCard((problem) => ({
                ...problem,
                memoryPalaceLoci: loci.length > 0 ? loci : undefined,
              }))
            }}
            onBriefCompartmentFilesAdd={addSelectedProblemCompartmentFiles}
            onBriefCompartmentAssetCompartmentChange={moveSelectedProblemCompartmentAsset}
            onBriefCompartmentAssetRemove={removeSelectedProblemCompartmentAsset}
            onPhoneBriefChange={(value) => {
              updateSelectedProblemCard((problem) => ({
                ...problem,
                phoneRelayBrief: value.trim() || undefined,
              }))
            }}
            onDesktopBriefChange={(value) => {
              updateSelectedProblemCard((problem) => ({
                ...problem,
                desktopSessionBrief: value.trim() || undefined,
              }))
            }}
            onCopyPacket={() => {
              void copyInspectorText('handoff packet', selectedProblemBlueprint?.handoffText ?? '')
            }}
            onCopyObjective={() => {
              void copyInspectorText('objective', launchObjective)
            }}
            onCopyLaunchBrief={() => {
              void copyInspectorText('launch brief', selectedProblemLaunchBrief)
            }}
            onLaunch={() => {
              void launchSelectedProblemSwarm()
            }}
            onStopRun={() => {
              void stopCurrentSwarmRun()
            }}
            onRefreshRuns={() => {
              void refreshRuns(false)
            }}
            onSelectRun={setCurrentRunId}
            onArtifactStatusChange={(runId, artifactId, status) => {
              updateSelectedProblemCard((problem) => ({
                ...problem,
                runLedger: updateRunArtifactStatus(problem.runLedger, runId, artifactId, status),
              }))
            }}
          />
        ) : selectedAgent ? (
          <aside className="freeform-problem-inspector" aria-label="Selected terminal inspector">
            <div className="freeform-problem-inspector-header">
              <div>
                <h2>Selected terminal</h2>
                <p>The DewDrop is live on the board. Use this panel for shell and session controls.</p>
              </div>
              <div className="freeform-problem-inspector-status">
                <span className="freeform-run-pill">
                  {selectedAgent.assignedToProblemId ? 'attached' : 'free'}
                </span>
              </div>
            </div>
            <section className="freeform-problem-inspector-section">
              <DewDropTerminalCard
                agent={selectedAgent}
                busy={workerTerminalBusyIds.includes(selectedAgent.id)}
                onTitleChange={updateAgentTitleById}
                onRuntimeChange={updateAgentRuntimeById}
                onStart={startWorkerTerminalAgent}
                onStop={stopWorkerTerminalAgent}
                onRefresh={refreshWorkerTerminalAgent}
                onSendInput={sendWorkerTerminalInput}
                autoFocusInput={false}
              />
            </section>
          </aside>
        ) : null}
      </div>
    </div>
  )
}
