import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { flushSync } from 'react-dom'
import type { BoardCamera, BoardWire, WorkflowCard } from './types'
import { hedgerowsDeltaSquadCards, hedgerowsPresetAgentCount } from './presets/hedgerowsDeltaSquad'
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
  clearPersistedBoard,
  inferAgentSummonCount,
  loadPersistedBoard,
  parseBoardJsonString,
  savePersistedBoard,
  stringifyBoard,
  type PersistedBoardV1,
} from './persistBoard'
import { buildProblemSwarmObjective } from './boardObjective'
import { touchPairMetrics } from './boardTouch'
import { ProblemSwarmInspector } from './components/ProblemSwarmInspector'
import { SwarmEnvelopeLayer } from './components/SwarmEnvelopeLayer'
import { SwarmRunList } from './components/SwarmRunList'
import { WorkflowCardView } from './components/WorkflowCardView'
import { agentSubUnionBounds, bestParentAgentTarget, bestProblemOverlap } from './cardOverlap'
import { DEFAULT_KANBAN_MIN_AGENT_WIDTH, cardDisplayHeight, magneticKanbanDockPosition } from './kanbanGeometry'
import { reflowHubKanbanLayout, reflowSubagentLayout } from './kanbanReflow'
import { openQuestionsForCard } from './openQuestions'
import { applyReleaseNod } from './releaseNod'
import { clampNumber, swarmRunIsActive } from './runFormat'
import { buildSwarmContractAgents } from './swarmContractAgents'
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
  marqueeViewportToWorldAabb,
  worldRectsIntersect,
  zoomAtPoint,
} from './viewportGeometry'
import { eventPathHitsBoardCard, pointerEventTargetEl } from './pointerDom'
import './board.css'

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

/** Default board = Hedgerows 2.0 Δ squad (virtual company preset). */
const SEED_CARDS: WorkflowCard[] = hedgerowsDeltaSquadCards()

type BootState = { cards: WorkflowCard[]; camera: BoardCamera; wires: BoardWire[] }
let bootStateMemo: BootState | null = null

function getBootStateOnce(): BootState {
  if (!bootStateMemo) {
    const p = loadPersistedBoard()
    bootStateMemo = {
      cards: p?.cards ?? SEED_CARDS,
      camera: p?.camera ?? { x: 0, y: 0, zoom: 1 },
      wires: p?.wires ?? [],
    }
  }
  return bootStateMemo
}

const SWARM_TEMPLATE_OPTIONS: Array<{ value: ButlerSwarmTemplate; label: string }> = [
  { value: 'planning', label: 'Planning' },
  { value: 'build', label: 'Build' },
  { value: 'research', label: 'Research' },
  { value: 'operator', label: 'Operator' },
  { value: 'relationship', label: 'Relationship' },
]

const TOOLBAR_PANEL_OPEN_KEY = 'dewdrops-toolbar-panel-open'

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

type SelectionTraceEntry = {
  id: number
  label: string
  detail: string
}

export default function BoardView() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  const [size, setSize] = useState({ w: 960, h: 640 })
  const [camera, setCamera] = useState<BoardCamera>(() => getBootStateOnce().camera)
  const [cards, setCards] = useState<WorkflowCard[]>(() => getBootStateOnce().cards)
  const [wires, setWires] = useState<BoardWire[]>(() => getBootStateOnce().wires)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [handshakeFocus, setHandshakeFocus] = useState<{ agentId: string; problemId: string } | null>(
    null,
  )
  const [boardNotice, setBoardNotice] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null)
  const [bridgeSettings, setBridgeSettings] = useState<ButlerBridgeSettings>(() => loadButlerBridgeSettings())
  const [bridgeHealth, setBridgeHealth] = useState<ButlerBridgeHealth | null>(null)
  const [bridgeBusy, setBridgeBusy] = useState(false)
  const [launchBusy, setLaunchBusy] = useState(false)
  const [stopBusy, setStopBusy] = useState(false)
  const [recentRuns, setRecentRuns] = useState<ButlerSwarmRun[]>([])
  const [currentRunId, setCurrentRunId] = useState('')
  const [currentRunReport, setCurrentRunReport] = useState<ButlerSwarmRunReport | null>(null)
  const [currentRunReportBusy, setCurrentRunReportBusy] = useState(false)
  const [launchTemplate, setLaunchTemplate] = useState<ButlerSwarmTemplate>('planning')
  const [launchObjective, setLaunchObjective] = useState('')
  const [toolbarPanelOpen, setToolbarPanelOpen] = useState(() => loadToolbarPanelOpen())
  const [traceEnabled, setTraceEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  })
  const [selectionTrace, setSelectionTrace] = useState<SelectionTraceEntry[]>([])

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
  }, [])

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

  useEffect(() => {
    const id = window.setTimeout(() => {
      savePersistedBoard(camera, cards, wires)
    }, 500)
    return () => window.clearTimeout(id)
  }, [camera, cards, wires])

  const agentSummon = useRef(inferAgentSummonCount(getBootStateOnce().cards))
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
  const sizeRef = useRef(size)
  const cameraRef = useRef(camera)

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
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
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
          if (hits.length > 0) {
            flushSync(() => {
              setSelectedIds((prev) =>
                e.shiftKey ? [...new Set([...prev, ...hits])] : hits,
              )
            })
          }
        } else {
          pushSelectionTrace('marquee.preserve', 'kept selection')
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

  const addAgentAt = (wx: number, wy: number) => {
    agentSummon.current += 1
    const n = agentSummon.current
    const w = 176
    const h = 112
    setCards((list) => [
      ...list,
      {
        id: newCardId(),
        x: wx - w / 2,
        y: wy - h / 2,
        width: w,
        height: h,
        title: `Agent ${n}`,
        expanded: true,
        color: '#af52de',
        kind: 'agent',
        assignedToProblemId: null,
        parentAgentId: null,
        management: 'manual',
      },
    ])
  }

  const resolveAgentAssignment = useCallback((agentId: string) => {
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

      let nextParent: string | null
      let nextPid: string | null

      if (subSticky && prevParent) {
        nextParent = prevParent
        const par = list.find((c) => c.id === prevParent && c.kind === 'agent')
        nextPid = par?.assignedToProblemId ?? null
      } else if (prevPid && !prevParent) {
        const union = swarmUnionBounds(prevPid, list, wiresNow)
        const prevProblem = list.find((c) => c.id === prevPid && c.kind === 'problem')
        const prevSlack = prevProblem ? problemEnvelopeStaySlack(prevProblem) : ENVELOPE_STAY_SLACK
        if (union && pointInBounds(cx, cy, expandBounds(union, prevSlack))) {
          nextPid = prevPid
          nextParent = null
        } else {
          const pArea = probHit?.area ?? 0
          const nArea = parHit?.area ?? 0
          if (pArea === 0 && nArea === 0) {
            nextParent = null
            nextPid = null
          } else if (nArea >= pArea && parHit) {
            nextParent = parHit.id
            const par = list.find((c) => c.id === parHit.id && c.kind === 'agent')
            nextPid = par?.assignedToProblemId ?? null
          } else if (probHit) {
            nextParent = null
            nextPid = probHit.id
          } else {
            nextParent = null
            nextPid = null
          }
        }
      } else {
        const pArea = probHit?.area ?? 0
        const nArea = parHit?.area ?? 0
        if (pArea === 0 && nArea === 0) {
          nextParent = null
          nextPid = null
        } else if (nArea >= pArea && parHit) {
          nextParent = parHit.id
          const par = list.find((c) => c.id === parHit.id && c.kind === 'agent')
          nextPid = par?.assignedToProblemId ?? null
        } else if (probHit) {
          nextParent = null
          nextPid = probHit.id
        } else {
          nextParent = null
          nextPid = null
        }
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
    clearPersistedBoard()
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

  const selectedProblem = selectedProblems.length === 1 ? selectedProblems[0] : null

  const selectedProblemAgents = useMemo(
    () => (selectedProblem ? agentsInProblemSwarm(selectedProblem.id, cards, wires) : []),
    [cards, selectedProblem, wires],
  )

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

  const selectedProblemDraftKey = useMemo(() => {
    if (!selectedProblem) return ''
    return [
      selectedProblem.id,
      selectedProblem.title,
      selectedProblem.mission ?? '',
      selectedProblem.swarmTemplate ?? '',
      (selectedProblem.openQuestions ?? []).join('|'),
      selectedProblemAgents.map((agent) => `${agent.id}:${agent.title}`).join('|'),
    ].join('::')
  }, [selectedProblem, selectedProblemAgents])

  useEffect(() => {
    if (!selectedProblem) {
      setLaunchObjective('')
      return
    }
    setLaunchTemplate((selectedProblem.swarmTemplate as ButlerSwarmTemplate | undefined) ?? 'planning')
    setLaunchObjective(buildProblemSwarmObjective(selectedProblem, cards, wires))
  }, [cards, selectedProblem, selectedProblemDraftKey, wires])

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

  const updateSelectedProblemLayout = useCallback(
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
        agents: buildSwarmContractAgents(
          selectedProblem,
          selectedProblemAgents,
          launchTemplate,
          launchObjective.trim(),
        ),
        room_id: selectedProblem.butlerRoomId,
        room_kind: 'project',
        target: 'local_desktop',
        launcher: 'desktop',
        metadata: {
          dewdrops_problem_id: selectedProblem.id,
          selected_agent_count: selectedProblemAgents.length,
          selected_agent_ids: selectedProblemAgents.map((agent) => agent.id),
        },
        source_refs: [`dewdrops/cards/${selectedProblem.id}`],
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
  }, [bridgeSettings, launchObjective, launchTemplate, refreshRuns, selectedProblem, selectedProblemAgents])

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
    addAgentAt(x, y)
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

        const draggingSelection = selectedIds.length > 1 && selectedIds.includes(cardId)
        if (draggingSelection) {
          const dx = nx - cur.x
          const dy = ny - cur.y
          if (dx === 0 && dy === 0) return list
          const movingIds = new Set(selectedIds)
          return list.map((item) =>
            movingIds.has(item.id)
              ? { ...item, x: item.x + dx, y: item.y + dy }
              : item,
          )
        }

        if (cur.kind !== 'agent') {
          return list.map((x) => (x.id === cardId ? { ...x, x: nx, y: ny } : x))
        }
        const inSwarm = !!(cur.assignedToProblemId || cur.parentAgentId)
        if (!inSwarm) {
          return list.map((x) => (x.id === cardId ? { ...x, x: nx, y: ny } : x))
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
      for (const draggedId of draggedIds) {
        const dragged = cardsRef.current.find((card) => card.id === draggedId)
        if (dragged?.kind === 'agent') {
          resolveAgentAssignment(draggedId)
        }
      }
    },
    [resolveAgentAssignment, selectedIds],
  )

  return (
    <div className="freeform-root">
      <header className="freeform-toolbar freeform-toolbar--minimal">
        <div className="freeform-toolbar-meta">
          <h1>DewDrops</h1>
          <p>Double-click empty space to summon an agent. Drag agents into a problem to form a swarm.</p>
        </div>
        <div className="freeform-toolbar-actions">
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
            title="Select and move cards — drag on empty canvas to marquee"
            onClick={() => {
              viewportRef.current?.focus()
            }}
          >
            Select
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
        {toolbarPanelOpen ? (
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
                      setLaunchTemplate(e.target.value as ButlerSwarmTemplate)
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
                      updateSelectedProblemLayout((problem) => ({
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
                      updateSelectedProblemLayout((problem) => ({
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
                      updateSelectedProblemLayout((problem) => ({
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
                      updateSelectedProblemLayout((problem) => ({
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
        ) : null}
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
              camera={camera}
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
              onMakeAgentReadable={
                c.kind === 'agent'
                  ? () => {
                      const AGENT_READ_MIN_W = 288
                      const AGENT_READ_MIN_H = 272
                      setCards((list) => {
                        let next = list.map((x) =>
                          x.id === c.id && x.kind === 'agent'
                            ? {
                                ...x,
                                expanded: true,
                                width: Math.max(x.width, AGENT_READ_MIN_W),
                                height: Math.max(x.height, AGENT_READ_MIN_H),
                              }
                            : x,
                        )
                        const agent = next.find((x) => x.id === c.id && x.kind === 'agent')
                        if (agent?.parentAgentId) {
                          next = reflowSubagentLayout(next, agent.parentAgentId)
                        } else if (agent?.assignedToProblemId) {
                          next = reflowHubKanbanLayout(next, agent.assignedToProblemId)
                        }
                        return next
                      })
                    }
                  : undefined
              }
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
            template={launchTemplate}
            templateOptions={SWARM_TEMPLATE_OPTIONS}
            objective={launchObjective}
            roomWidth={selectedProblemRoomWidth}
            roomHeight={selectedProblemRoomHeight}
            membranePad={selectedProblemEnvelopePad}
            cardWidth={selectedProblemAgentWidth}
            runs={visibleRuns}
            currentRunId={currentRunId}
            currentRunReport={currentRunReport}
            reportBusy={currentRunReportBusy}
            launchBusy={launchBusy}
            stopBusy={stopBusy}
            onTemplateChange={setLaunchTemplate}
            onObjectiveChange={setLaunchObjective}
            onRoomWidthChange={(value) => {
              const nextWidth = clampNumber(value, 160, 720)
              updateSelectedProblemLayout((problem) => ({
                ...problem,
                width: nextWidth,
                problemBaseWidth: nextWidth,
              }))
            }}
            onRoomHeightChange={(value) => {
              const nextHeight = clampNumber(value, 100, 520)
              updateSelectedProblemLayout((problem) => ({
                ...problem,
                height: nextHeight,
                problemBaseHeight: nextHeight,
              }))
            }}
            onMembranePadChange={(value) => {
              const nextPad = clampNumber(value, 0, 120)
              updateSelectedProblemLayout((problem) => ({
                ...problem,
                swarmEnvelopePad: nextPad,
              }))
            }}
            onCardWidthChange={(value) => {
              const nextWidth = clampNumber(value, 96, 260)
              updateSelectedProblemLayout((problem) => ({
                ...problem,
                swarmAgentMinWidth: nextWidth,
              }))
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
          />
        ) : null}
      </div>
    </div>
  )
}
