import { useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { PointerEvent } from 'react'
import { normalizeBriefSpec, type AcceptanceCriterion, type BriefSpec } from '../briefSpec'
import { countSubagents } from '../cardOverlap'
import { descendantHasOpenQuestions, openQuestionsForCard } from '../openQuestions'
import { pointerEventTargetEl } from '../pointerDom'
import { formatRunStatus, swarmRunIsActive } from '../runFormat'
import { swarmMassForProblem } from '../swarmAgents'
import type { BoardCamera, BoardWire, WorkflowCard } from '../types'
import { DewDropTerminalSurface } from './DewDropTerminalSurface'
import { OpenQuestionsBlock } from './OpenQuestionsBlock'

export type ProblemSessionSummary = {
  workspaceLabel: string
  launchSurfaceLabel: string
  memoryLabel: string
  anchorCount: number
  readinessLabel: string
  readinessTone: 'ready' | 'attention' | 'missing'
}

export type CardViewProps = {
  card: WorkflowCard
  cards: WorkflowCard[]
  wires: BoardWire[]
  handshakeFocus: { agentId: string; problemId: string } | null
  selected: boolean
  activeTerminal?: boolean
  camera: BoardCamera
  problemSessionSummary?: ProblemSessionSummary
  problemRunStatus?: string
  problemRunSummary?: string
  problemRunId?: string
  agentRunStatus?: string
  agentRunSummary?: string
  agentTerminalBusy?: boolean
  onSelect: (shiftKey?: boolean) => void
  onMove: (x: number, y: number) => void
  onResize: (width: number, height: number) => void
  onDragEnd: () => void
  onToggleExpand: () => void
  onProblemBriefChange?: (problemId: string, briefSpec: BriefSpec) => void
  onAgentTerminalStart?: (agentId: string) => void
  onAgentTerminalStop?: (agentId: string) => void
  onAgentTerminalRefresh?: (agentId: string) => void
  onAgentTerminalReturnArtifact?: (agentId: string) => void
  onAgentTerminalSendInput?: (agentId: string, input: string) => void
  onAgentTerminalResize?: (agentId: string, sessionId: string, cols: number, rows: number) => void
  onReleaseNod: (agentId: string, which: 'specialist' | 'lead') => void
  /** Pause hub overlap ejection while this card is being moved or resized. */
  onMarkUserMovingCard?: () => void
  /** First contact on card — pause overlap sim before drag/selection handlers run. */
  onCardPointerSession?: () => void
  /** Dev trace for pointer/selection routing. */
  onTrace?: (label: string, detail: string) => void
}

type ProblemPerception = 'panorama' | 'workbench' | 'close-read'

const PROBLEM_PERCEPTION_OPTIONS: Array<{
  value: ProblemPerception
  label: string
  detail: string
}> = [
  { value: 'panorama', label: 'Big picture', detail: 'Whole-room read' },
  { value: 'workbench', label: 'Work surface', detail: 'Balanced interior' },
  { value: 'close-read', label: 'Close read', detail: 'Micro detail' },
]

const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, option, label, [role="button"], [contenteditable="true"]'
const TERMINAL_INTERACTIVE_SELECTOR =
  '.freeform-terminal-surface, .freeform-terminal-canvas, .xterm, .xterm-screen, .xterm-helper-textarea'

function clampRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function nextCriterionId(criteria: readonly AcceptanceCriterion[]): string {
  const taken = new Set(criteria.map((criterion) => criterion.id))
  let index = criteria.length + 1
  while (taken.has(`criterion-${index}`)) {
    index += 1
  }
  return `criterion-${index}`
}

function suggestedBriefcaseFootprint({
  perception,
  missionLength,
  missionParagraphs,
  agentCount,
  openQuestionCount,
  provenanceCount,
  hasRun,
  hasSession,
}: {
  perception: ProblemPerception
  missionLength: number
  missionParagraphs: number
  agentCount: number
  openQuestionCount: number
  provenanceCount: number
  hasRun: boolean
  hasSession: boolean
}): { width: number; height: number } {
  const baseWidth =
    perception === 'panorama' ? 440 : perception === 'close-read' ? 560 : 360
  const baseHeight =
    perception === 'panorama' ? 248 : perception === 'close-read' ? 392 : 310

  const width =
    baseWidth +
    (missionLength > 220 ? 40 : missionLength > 120 ? 20 : 0) +
    (agentCount >= 5 ? 80 : agentCount >= 3 ? 40 : agentCount > 0 ? 20 : 0) +
    (openQuestionCount >= 3 ? 60 : openQuestionCount > 0 ? 28 : 0) +
    (provenanceCount >= 4 ? 36 : provenanceCount > 0 ? 18 : 0) +
    (hasRun ? 24 : 0) +
    (hasSession ? 18 : 0)

  const height =
    baseHeight +
    Math.max(0, missionParagraphs - 1) * 34 +
    Math.min(180, agentCount * (perception === 'panorama' ? 10 : 22)) +
    openQuestionCount * (perception === 'panorama' ? 14 : 26) +
    (hasRun ? 54 : 0) +
    (hasSession ? 42 : 0) +
    (provenanceCount > 0 ? 34 : 0)

  return {
    width: clampRange(width, 280, 860),
    height: clampRange(height, 180, 1200),
  }
}

export function WorkflowCardView({
  card,
  cards,
  wires,
  handshakeFocus,
  selected,
  activeTerminal = false,
  camera,
  problemSessionSummary,
  problemRunStatus,
  problemRunSummary,
  problemRunId,
  agentRunStatus,
  agentRunSummary,
  agentTerminalBusy = false,
  onSelect,
  onMove,
  onResize,
  onDragEnd,
  onToggleExpand,
  onProblemBriefChange,
  onAgentTerminalStart,
  onAgentTerminalStop,
  onAgentTerminalRefresh,
  onAgentTerminalReturnArtifact,
  onAgentTerminalSendInput,
  onAgentTerminalResize,
  onReleaseNod,
  onMarkUserMovingCard,
  onCardPointerSession,
  onTrace,
}: CardViewProps) {
  const headerRef = useRef<HTMLDivElement | null>(null)
  const problemBodyRef = useRef<HTMLDivElement | null>(null)
  const agentBodyRef = useRef<HTMLDivElement | null>(null)
  const prevExpandedRef = useRef(false)
  const prevPerceptionRef = useRef<ProblemPerception>('workbench')
  const prevActiveTerminalRef = useRef(false)
  const [problemPerception, setProblemPerception] = useState<ProblemPerception>('workbench')
  const drag = useRef<{
    sx: number
    sy: number
    cx: number
    cy: number
    moved: boolean
    source: 'header' | 'body'
  } | null>(null)
  const resize = useRef<{ sx: number; sy: number; w: number; h: number } | null>(null)
  const DRAG_START_SLOP = 3

  const beginDrag = (
    e: PointerEvent,
    source: 'header' | 'body',
    captureEl: HTMLElement,
  ) => {
    onCardPointerSession?.()
    onMarkUserMovingCard?.()
    drag.current = {
      sx: e.clientX,
      sy: e.clientY,
      cx: card.x,
      cy: card.y,
      moved: false,
      source,
    }
    if (typeof captureEl.setPointerCapture === 'function') {
      captureEl.setPointerCapture(e.pointerId)
    }
  }

  const onBodyPointerDown = (e: PointerEvent) => {
    if (card.kind === 'agent' && activeTerminal) return
    if (e.button !== 0 || resize.current) return
    const el = pointerEventTargetEl(e)
    if (!el) return
    if (el.closest(INTERACTIVE_SELECTOR)) return
    onTrace?.('card.body.pointerdown', `${card.id} body`)
    e.stopPropagation()
    if (e.shiftKey) return
    if (!selected) {
      selectNow(false)
    }
    beginDrag(e, 'body', e.currentTarget as HTMLElement)
  }

  /** Problem / surface: whole header drags; selection comes from card capture. */
  const onHeaderPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || resize.current) return
    const el = pointerEventTargetEl(e)
    if (!el) return
    onTrace?.('card.header.pointerdown', `${card.id} header`)
    e.stopPropagation()
    if (e.shiftKey) return
    beginDrag(e, 'header', e.currentTarget as HTMLElement)
  }

  const onAgentHeaderPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || resize.current) return
    const el = pointerEventTargetEl(e)
    if (!el) return
    onTrace?.('card.agentHeader.pointerdown', `${card.id} agent-header`)
    e.stopPropagation()
    if (e.shiftKey) return
    if (!selected) {
      selectNow(false)
    }
    beginDrag(e, 'header', e.currentTarget as HTMLElement)
  }

  const selectNow = (shiftKey?: boolean) => {
    flushSync(() => onSelect(shiftKey))
  }

  /** Pointer-down on a card selects it. Empty-canvas pointer-down starts marquee. */
  const shouldIgnoreSelectTarget = (el: Element | null) => {
    if (!el) return true
    if (el.closest(INTERACTIVE_SELECTOR)) return true
    if (el.closest(TERMINAL_INTERACTIVE_SELECTOR)) return true
    if (el.closest('.freeform-card-resize-handle')) return true
    return false
  }

  const onCardPointerDownCapture = (e: PointerEvent) => {
    if (e.button !== 0) return
    const el = pointerEventTargetEl(e)
    if (shouldIgnoreSelectTarget(el)) {
      onTrace?.('card.pointerdown.capture', `${card.id} ignored target`)
      return
    }
    if (selected && !e.shiftKey) {
      onTrace?.('card.pointerdown.capture', `${card.id} keep selection`)
      return
    }
    onTrace?.('card.pointerdown.capture', `${card.id}${e.shiftKey ? ' shift' : ''}`)
    selectNow(e.shiftKey)
  }

  const onHeaderPointerMove = (e: PointerEvent) => {
    if (!drag.current) return
    const z = camera.zoom
    const rawDx = e.clientX - drag.current.sx
    const rawDy = e.clientY - drag.current.sy
    const dx = rawDx / z
    const dy = rawDy / z
    if (!drag.current.moved) {
      if (Math.abs(rawDx) < DRAG_START_SLOP && Math.abs(rawDy) < DRAG_START_SLOP) return
      drag.current.moved = true
    }
    onMove(drag.current.cx + dx, drag.current.cy + dy)
  }

  const onHeaderPointerUp = () => {
    const activeDrag = drag.current
    drag.current = null
    if (!activeDrag) return
    if (activeDrag.moved) {
      onDragEnd()
    }
  }

  const onResizePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    onCardPointerSession?.()
    onMarkUserMovingCard?.()
    selectNow(e.shiftKey)
    const h = card.expanded ? card.height : 44
    resize.current = { sx: e.clientX, sy: e.clientY, w: card.width, h }
    if (typeof (e.currentTarget as HTMLElement).setPointerCapture === 'function') {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
  }

  const onResizePointerMove = (e: PointerEvent) => {
    if (!resize.current) return
    const z = camera.zoom
    const dx = (e.clientX - resize.current.sx) / z
    const dy = (e.clientY - resize.current.sy) / z
    const minW = 120
    if (card.expanded) {
      const minH = 80
      onResize(
        Math.max(minW, resize.current.w + dx),
        Math.max(minH, resize.current.h + dy),
      )
    } else {
      onResize(Math.max(minW, resize.current.w + dx), card.height)
    }
  }

  const onResizePointerUp = () => {
    const wasResizing = resize.current !== null
    resize.current = null
    if (wasResizing) onDragEnd()
  }

  const kindClass =
    card.kind === 'problem' ? ' kind-problem' : card.kind === 'agent' ? ' kind-agent' : ''

  const assignedAgents =
    card.kind === 'problem'
      ? cards.filter(
          (a) => a.kind === 'agent' && a.assignedToProblemId === card.id && !a.parentAgentId,
        )
      : []

  const subagentCount = card.kind === 'agent' ? countSubagents(card.id, cards) : 0
  const subtreeNeedsHelp =
    card.kind === 'agent' && descendantHasOpenQuestions(card.id, cards, wires)

  const assignedClass =
    card.kind === 'agent' && (card.assignedToProblemId || card.parentAgentId)
      ? ' assigned freeform-agent-kanban-dock'
      : ''
  const nestedClass = card.kind === 'agent' && card.parentAgentId ? ' freeform-agent-nested' : ''
  const subtreeClass = subtreeNeedsHelp ? ' freeform-agent-subtree-needs-help' : ''

  const swarmMass =
    card.kind === 'problem' ? swarmMassForProblem(card.id, cards, wires) : 0

  const assignedProblem =
    card.kind === 'agent' && card.assignedToProblemId
      ? cards.find((p) => p.id === card.assignedToProblemId)
      : undefined

  const handshakeProblem = assignedProblem
  const handshakePulse =
    !!handshakeFocus &&
    handshakeFocus.agentId === card.id &&
    handshakeProblem &&
    handshakeFocus.problemId === handshakeProblem.id

  const opens = openQuestionsForCard(card, cards, wires)
  const hasOpenQuestions = opens.length > 0
  const isAgent = card.kind === 'agent'
  const agentQuestionGlow = isAgent && hasOpenQuestions
  /** Blue = pool/prepared, green = in swarm/working, orange = open questions (matches toolbar legend). */
  const agentInSwarm =
    isAgent && !agentQuestionGlow && (!!card.assignedToProblemId || !!card.parentAgentId)
  const agentGlowClass = agentQuestionGlow
    ? ' freeform-agent-glow-questions'
    : agentInSwarm
      ? ' freeform-agent-glow-working'
      : isAgent
        ? ' freeform-agent-glow-prepared'
        : ''
  const swarmLinked = isAgent && (!!card.assignedToProblemId || !!card.parentAgentId)
  const showGlobalOpenFlash = hasOpenQuestions && !isAgent
  const problemBubble = card.kind === 'problem' && card.problemShape === 'bubble'
  const problemExpanded = card.kind === 'problem' && card.expanded
  const problemHasProvenance =
    card.kind === 'problem' &&
    ((card.runLedger?.length ?? 0) > 0 || (card.briefCompartmentAssets?.length ?? 0) > 0 || (card.memoryAnchors?.length ?? 0) > 0)
  const problemProvenanceCount =
    card.kind === 'problem'
      ? (card.runLedger?.length ?? 0) + (card.briefCompartmentAssets?.length ?? 0) + (card.memoryAnchors?.length ?? 0)
      : 0
  const problemMission =
    card.kind === 'problem'
      ? card.briefSpec?.creative.mission?.trim() || card.mission?.trim() || ''
      : ''
  const problemBriefSpec =
    card.kind === 'problem' ? normalizeBriefSpec(card.briefSpec, `brief-${card.id}`) : null
  const taskLabel =
    card.kind === 'problem'
      ? card.briefSpec?.execution.task?.trim() || problemMission || 'Set the North Star.'
      : ''
  const beneficiaryLabel =
    card.kind === 'problem' ? card.briefSpec?.creative.beneficiary?.trim() || '' : ''
  const missionParagraphs = problemMission ? problemMission.split(/\n\n+/).filter(Boolean) : []
  const missionLeadParagraph =
    missionParagraphs[0] ??
    'Keep the goal, constraints, and next decision here so the room stays legible.'
  const memoryAnchorCount = card.kind === 'problem' ? card.memoryAnchors?.length ?? 0 : 0
  const briefAssetCount = card.kind === 'problem' ? card.briefCompartmentAssets?.length ?? 0 : 0
  const runLedgerCount = card.kind === 'problem' ? card.runLedger?.length ?? 0 : 0
  const quickCriteria = problemBriefSpec?.execution.acceptanceCriteria ?? []
  const briefSetupCount =
    (problemBriefSpec?.creative.mission.trim() ? 1 : 0) +
    (problemBriefSpec?.execution.task.trim() ? 1 : 0) +
    (quickCriteria.length > 0 ? 1 : 0)
  const assignedAgentSignature = assignedAgents.map((agent) => agent.title).join('|')
  const openQuestionSignature = opens.join('|')
  const perceptionFootprint = suggestedBriefcaseFootprint({
    perception: problemPerception,
    missionLength: Math.max(taskLabel.length, problemMission.length) + beneficiaryLabel.length,
    missionParagraphs: Math.max(1, missionParagraphs.length),
    agentCount: assignedAgents.length,
    openQuestionCount: opens.length,
    provenanceCount: problemProvenanceCount,
    hasRun: !!problemRunStatus,
    hasSession: !!problemSessionSummary,
  })
  const showInlineAgentTerminal = card.kind === 'agent' && card.expanded && activeTerminal

  useLayoutEffect(() => {
    if (card.kind === 'problem' && !card.expanded) {
      prevExpandedRef.current = false
    }
  }, [card.expanded, card.kind])

  useLayoutEffect(() => {
    if (!showInlineAgentTerminal) {
      prevActiveTerminalRef.current = false
    }
  }, [showInlineAgentTerminal])

  useLayoutEffect(() => {
    if (card.kind !== 'problem' || !card.expanded) return
    const justOpened = !prevExpandedRef.current
    const perceptionChanged = prevPerceptionRef.current !== problemPerception
    const bodyEl = problemBodyRef.current
    if (!bodyEl) {
      prevExpandedRef.current = card.expanded
      prevPerceptionRef.current = problemPerception
      return
    }
    const scrollHeight = Math.ceil(bodyEl.scrollHeight)
    const clientHeight = Math.ceil(bodyEl.clientHeight)
    const headerHeight = Math.ceil(headerRef.current?.getBoundingClientRect().height ?? 0)
    const measuredHeight =
      Number.isFinite(scrollHeight) && Number.isFinite(clientHeight) && scrollHeight - clientHeight > 12
        ? headerHeight + scrollHeight + 12
        : card.height

    let nextWidth = card.width
    let nextHeight = card.height

    if (justOpened || perceptionChanged) {
      nextWidth = perceptionFootprint.width
      nextHeight = perceptionFootprint.height
    }

    nextHeight = Math.max(nextHeight, measuredHeight)
    nextWidth = clampRange(nextWidth, 120, 860)
    nextHeight = clampRange(nextHeight, 80, 1200)

    prevExpandedRef.current = card.expanded
    prevPerceptionRef.current = problemPerception

    if (Math.abs(nextWidth - card.width) <= 6 && Math.abs(nextHeight - card.height) <= 6) return
    onResize(nextWidth, nextHeight)
  }, [
    card.briefSpec?.execution.task,
    card.expanded,
    card.height,
    card.kind,
    card.mission,
    card.width,
    assignedAgentSignature,
    openQuestionSignature,
    onResize,
    perceptionFootprint.height,
    perceptionFootprint.width,
    problemPerception,
    problemHasProvenance,
    problemMission,
    problemProvenanceCount,
    problemRunId,
    problemRunStatus,
    problemRunSummary,
    problemSessionSummary?.anchorCount,
    problemSessionSummary?.launchSurfaceLabel,
    problemSessionSummary?.memoryLabel,
    problemSessionSummary?.readinessLabel,
    problemSessionSummary?.workspaceLabel,
    selected,
  ])

  useLayoutEffect(() => {
    if (!showInlineAgentTerminal) return
    const justOpened = !prevActiveTerminalRef.current
    const bodyEl = agentBodyRef.current
    if (!bodyEl) {
      prevActiveTerminalRef.current = true
      return
    }

    const scrollHeight = Math.ceil(bodyEl.scrollHeight)
    const clientHeight = Math.ceil(bodyEl.clientHeight)
    const scrollWidth = Math.ceil(bodyEl.scrollWidth)
    const clientWidth = Math.ceil(bodyEl.clientWidth)
    const headerHeight = Math.ceil(headerRef.current?.getBoundingClientRect().height ?? 0)

    let nextWidth = card.width
    let nextHeight = card.height

    if (justOpened) {
      nextWidth = Math.max(nextWidth, 360)
      nextHeight = Math.max(nextHeight, 320)
    }

    if (
      Number.isFinite(scrollWidth) &&
      Number.isFinite(clientWidth) &&
      scrollWidth - clientWidth > 12
    ) {
      nextWidth = Math.max(nextWidth, scrollWidth + 28)
    }

    if (
      Number.isFinite(scrollHeight) &&
      Number.isFinite(clientHeight) &&
      scrollHeight - clientHeight > 12
    ) {
      nextHeight = Math.max(nextHeight, headerHeight + scrollHeight + 12)
    }

    nextWidth = clampRange(nextWidth, 176, 760)
    nextHeight = clampRange(nextHeight, 112, 960)
    prevActiveTerminalRef.current = true

    if (Math.abs(nextWidth - card.width) <= 6 && Math.abs(nextHeight - card.height) <= 6) return
    onResize(nextWidth, nextHeight)
  }, [
    card.agentRuntime?.command,
    card.agentRuntime?.sessionState?.outputVersion,
    card.agentRuntime?.sessionState?.logTail,
    card.agentRuntime?.sessionState?.sessionId,
    card.agentRuntime?.sessionState?.status,
    card.agentRuntime?.sessionState?.terminalBuffer,
    card.agentRuntime?.workspaceRoot,
    card.expanded,
    card.height,
    card.kind,
    card.width,
    onResize,
    selected,
    showInlineAgentTerminal,
  ])

  const titleFrameClass =
    card.kind === 'agent'
      ? 'freeform-card-title-frame freeform-card-title-frame--agent'
      : card.kind === 'problem'
        ? 'freeform-card-title-frame freeform-card-title-frame--problem'
        : 'freeform-card-title-frame freeform-card-title-frame--surface'
  const briefHarnessEditable = !!onProblemBriefChange

  const updateProblemBrief = (mutate: (briefSpec: BriefSpec) => BriefSpec) => {
    if (card.kind !== 'problem' || !problemBriefSpec || !onProblemBriefChange) return
    onProblemBriefChange(card.id, mutate(problemBriefSpec))
  }

  const renderBriefHarness = (detail: boolean) =>
    problemBriefSpec ? (
      <section
        className="freeform-briefcase-harness"
        aria-label="Brief setup harness"
        onPointerDownCapture={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="freeform-briefcase-harness-head">
          <div>
            <strong>Setup harness</strong>
            <span>
              {briefSetupCount}/3 core brief anchors set
              {detail ? ' · editing in place' : ' · shape the room here'}
            </span>
          </div>
          <button
            type="button"
            className="freeform-mini-btn"
            disabled={!briefHarnessEditable}
            onClick={() =>
              updateProblemBrief((briefSpec) => ({
                ...briefSpec,
                execution: {
                  ...briefSpec.execution,
                  acceptanceCriteria: [
                    ...briefSpec.execution.acceptanceCriteria,
                    {
                      id: nextCriterionId(briefSpec.execution.acceptanceCriteria),
                      description: '',
                    },
                  ],
                },
              }))
            }
          >
            Add criterion
          </button>
        </div>

        <div className="freeform-problem-inspector-grid freeform-problem-inspector-grid--briefcase">
          <label className="freeform-field">
            <span>Mission</span>
            <textarea
              rows={detail ? 3 : 2}
              value={problemBriefSpec.creative.mission}
              placeholder="Why this room exists and what outcome truth it serves."
              disabled={!briefHarnessEditable}
              onChange={(e) =>
                updateProblemBrief((briefSpec) => ({
                  ...briefSpec,
                  creative: {
                    ...briefSpec.creative,
                    mission: e.target.value,
                  },
                }))
              }
            />
          </label>

          <label className="freeform-field">
            <span>Task</span>
            <textarea
              rows={detail ? 3 : 2}
              value={problemBriefSpec.execution.task}
              placeholder="Verb-first execution ask for the swarm."
              disabled={!briefHarnessEditable}
              onChange={(e) =>
                updateProblemBrief((briefSpec) => ({
                  ...briefSpec,
                  execution: {
                    ...briefSpec.execution,
                    task: e.target.value,
                  },
                }))
              }
            />
          </label>
        </div>

        <div className="freeform-problem-inspector-grid freeform-problem-inspector-grid--briefcase">
          <label className="freeform-field">
            <span>Beneficiary</span>
            <input
              type="text"
              value={problemBriefSpec.creative.beneficiary}
              placeholder="Who this room serves"
              disabled={!briefHarnessEditable}
              onChange={(e) =>
                updateProblemBrief((briefSpec) => ({
                  ...briefSpec,
                  creative: {
                    ...briefSpec.creative,
                    beneficiary: e.target.value,
                  },
                }))
              }
            />
          </label>

          <div className="freeform-briefcase-harness-status">
            <div className="freeform-mode-chip">
              <strong>Criteria</strong>
              <span>
                {quickCriteria.length > 0
                  ? `${quickCriteria.length} acceptance criterion${quickCriteria.length === 1 ? '' : 'a'}`
                  : 'No acceptance criteria yet'}
              </span>
            </div>
            <div className="freeform-mode-chip">
              <strong>Autonomy</strong>
              <span>{problemBriefSpec.autonomyPolicy.replace(/-/g, ' ')}</span>
            </div>
          </div>
        </div>

        <div className="freeform-briefcase-criteria-list" aria-label="Acceptance criteria quick editor">
          {quickCriteria.length === 0 ? (
            <p className="freeform-briefcase-muted-copy">
              Add at least one acceptance criterion so the harness knows what done means.
            </p>
          ) : (
            quickCriteria.map((criterion, index) => (
              <article key={criterion.id} className="freeform-briefcase-criterion-card">
                <div className="freeform-briefcase-criterion-head">
                  <strong>Criterion {index + 1}</strong>
                  <button
                    type="button"
                    className="freeform-mini-btn"
                    disabled={!briefHarnessEditable}
                    onClick={() =>
                      updateProblemBrief((briefSpec) => ({
                        ...briefSpec,
                        execution: {
                          ...briefSpec.execution,
                          acceptanceCriteria: briefSpec.execution.acceptanceCriteria.filter(
                            (entry) => entry.id !== criterion.id,
                          ),
                        },
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
                <label className="freeform-field">
                  <span>Description</span>
                  <textarea
                    rows={detail ? 2 : 1}
                    value={criterion.description}
                    placeholder="What must be true for this room to count as done?"
                    disabled={!briefHarnessEditable}
                    onChange={(e) =>
                      updateProblemBrief((briefSpec) => ({
                        ...briefSpec,
                        execution: {
                          ...briefSpec.execution,
                          acceptanceCriteria: briefSpec.execution.acceptanceCriteria.map((entry) =>
                            entry.id === criterion.id
                              ? { ...entry, description: e.target.value }
                              : entry,
                          ),
                        },
                      }))
                    }
                  />
                </label>
                {detail ? (
                  <label className="freeform-field">
                    <span>Verification hint</span>
                    <input
                      type="text"
                      value={criterion.verificationHint ?? ''}
                      placeholder="How should the agent or human verify this?"
                      disabled={!briefHarnessEditable}
                      onChange={(e) =>
                        updateProblemBrief((briefSpec) => ({
                          ...briefSpec,
                          execution: {
                            ...briefSpec.execution,
                            acceptanceCriteria: briefSpec.execution.acceptanceCriteria.map((entry) =>
                              entry.id === criterion.id
                                ? { ...entry, verificationHint: e.target.value || undefined }
                                : entry,
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    ) : null

  const latestLedgerEntry = card.kind === 'problem' ? card.runLedger?.[0] : undefined
  const latestLedgerArtifact = latestLedgerEntry?.artifacts?.[0]

  const renderProblemRunSummary = () => {
    if (problemRunStatus) {
      return (
        <div className="freeform-problem-run-summary">
          <div className="freeform-problem-run-summary-head">
            <strong>Latest run</strong>
            {problemRunId ? <span>{problemRunId.slice(-6)}</span> : null}
          </div>
          <p>{problemRunSummary || 'Run launched from Butler. Report pending.'}</p>
        </div>
      )
    }

    if (!latestLedgerEntry) return null
    return (
      <div className="freeform-problem-run-summary">
        <div className="freeform-problem-run-summary-head">
          <strong>Latest return</strong>
          <span>{latestLedgerEntry.runId.slice(-6)}</span>
        </div>
        <p>{latestLedgerArtifact?.summary || `${latestLedgerEntry.title} returned to the briefcase.`}</p>
      </div>
    )
  }

  const renderProblemSessionStrip = () =>
    problemSessionSummary ? (
      <div className="freeform-problem-session-strip">
        <span className="freeform-session-pill">{problemSessionSummary.workspaceLabel}</span>
        <span className="freeform-session-pill">{problemSessionSummary.launchSurfaceLabel}</span>
        <span className="freeform-session-pill">{problemSessionSummary.memoryLabel}</span>
        {problemSessionSummary.anchorCount > 0 ? (
          <span className="freeform-session-pill">
            {problemSessionSummary.anchorCount} anchor
            {problemSessionSummary.anchorCount === 1 ? '' : 's'}
          </span>
        ) : null}
        <span className={`freeform-session-pill is-${problemSessionSummary.readinessTone}`}>
          {problemSessionSummary.readinessLabel}
        </span>
      </div>
    ) : null

  const renderMissionBlock = () =>
    problemMission ? (
      <div className="freeform-briefcase-mission-copy">
        {missionParagraphs.map((paragraph, index) => (
          <p key={`${card.id}-mission-${index}`}>{paragraph}</p>
        ))}
      </div>
    ) : (
      <p className="freeform-briefcase-muted-copy">
        Keep the goal, constraints, and next decision here. Drop terminals into this problem and
        the swarm forms around the bottleneck automatically.
      </p>
    )

  const renderAssignedAgents = () =>
    assignedAgents.length ? (
      <div className="freeform-briefcase-agent-stack">
        <div className="freeform-briefcase-section-kicker">Connected terminals</div>
        {assignedAgents.map((agent) => (
          <div key={agent.id} className="freeform-agent-pill freeform-agent-pill-with-actions">
            <span className="dot" style={{ background: agent.color }} />
            <span className="freeform-agent-pill-label">{agent.title}</span>
            <button
              type="button"
              className={`freeform-mini-btn${agent.releaseNodFromLead ? ' is-on' : ''}`}
              title="Lead agrees this terminal can leave the sack (needs specialist nod too)"
              onClick={(e) => {
                e.stopPropagation()
                onReleaseNod(agent.id, 'lead')
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {agent.releaseNodFromLead ? 'Lead ✓ release' : 'Lead: release'}
            </button>
          </div>
        ))}
      </div>
    ) : (
      <p className="freeform-briefcase-muted-copy">
        No terminals in the swarm yet. Double-click empty space to spin one up, then drop it into this
        bubble and let the envelope pull it in.
      </p>
    )

  const briefcasePanels =
    problemPerception === 'panorama'
      ? [
          {
            kicker: 'Big picture',
            title: taskLabel,
            copy: beneficiaryLabel || missionLeadParagraph,
          },
          {
            kicker: 'Load',
            title:
              assignedAgents.length > 0
                ? `${assignedAgents.length} terminal${assignedAgents.length === 1 ? '' : 's'} spanning the room`
                : 'Room is quiet',
            copy:
              problemRunStatus
                ? `${formatRunStatus(problemRunStatus)} · ${problemRunSummary || 'The live pass is unfolding.'}`
                : 'Wake the swarm and the inside stretches around live work.',
          },
          {
            kicker: 'Signals',
            title:
              opens.length > 0
                ? `${opens.length} live decision${opens.length === 1 ? '' : 's'}`
                : problemHasProvenance
                  ? `${problemProvenanceCount} trace${problemProvenanceCount === 1 ? '' : 's'} on return`
                  : 'No active knots',
            copy: opens[0] || 'No steering pulse is active right now.',
          },
          {
            kicker: 'Lens',
            title: 'Panorama interior',
            copy: 'Zoomed out for the whole room. Switch scale when you need the guts of the work.',
          },
        ]
      : problemPerception === 'close-read'
        ? [
            {
              kicker: 'Close brief',
              title: taskLabel,
              copy: beneficiaryLabel || 'Outcome truth and beneficiary are in focus here.',
            },
            {
              kicker: 'Active thread',
              title:
                problemRunStatus
                  ? `${formatRunStatus(problemRunStatus)}${problemRunId ? ` · ${problemRunId.slice(-6)}` : ''}`
                  : assignedAgents.length > 0
                    ? `${assignedAgents.length} terminals inside the briefcase`
                    : 'No live run yet',
              copy: problemRunSummary || 'Zoomed in for decisions, evidence, and the next precise move.',
            },
            {
              kicker: 'Return path',
              title:
                problemHasProvenance
                  ? `${problemProvenanceCount} recorded trace${problemProvenanceCount === 1 ? '' : 's'}`
                  : 'Return path still empty',
              copy:
                problemHasProvenance
                  ? 'Runs, anchors, and compartment assets stay reachable when you need to reread them.'
                  : 'The return path fills only when work or evidence deserves to stick.',
            },
            {
              kicker: 'Lens',
              title: 'Close read interior',
              copy: 'Micro detail, knots, and provenance stay large enough to decipher without squinting.',
            },
          ]
        : [
            {
              kicker: 'Brief',
              title: taskLabel,
              copy:
                beneficiaryLabel
                  ? `For ${beneficiaryLabel}.`
                  : 'Outcome truth, constraints, and intent live here.',
            },
            {
              kicker: 'Build',
              title:
                assignedAgents.length > 0
                  ? `${assignedAgents.length} terminal${assignedAgents.length === 1 ? '' : 's'} mobilized`
                  : 'Swarm not loaded yet',
              copy:
                assignedAgents.length > 0
                  ? 'Terminals can work the current choke point in parallel.'
                  : 'Drop terminals into the briefcase and let the work surface expand.',
            },
            {
              kicker: 'Return',
              title:
                problemHasProvenance
                  ? `${problemProvenanceCount} recorded trace${problemProvenanceCount === 1 ? '' : 's'}`
                  : 'No recorded provenance yet',
              copy:
                problemHasProvenance
                  ? 'Runs, anchors, and compartment assets can be revisited later.'
                  : 'The briefcase stays light until work begins or evidence is added.',
            },
            {
              kicker: 'Lens',
              title: 'Workbench interior',
              copy: 'Balanced for steering the swarm and reading the room at once.',
            },
          ]

  return (
    <div
      data-board-card={card.id}
      className={`freeform-card${kindClass}${assignedClass}${nestedClass}${subtreeClass}${
        problemBubble ? ' freeform-problem-bubble' : ''
      }${card.kind === 'problem' && swarmMass > 0 ? ' freeform-problem-swarm-active' : ''}${
        swarmLinked ? ' freeform-agent-swarm-linked' : ''
      }${selected ? ' selected' : ''}${showGlobalOpenFlash ? ' has-open-questions' : ''}${agentGlowClass}${
        card.expanded ? '' : ' collapsed'
      }${card.kind === 'problem' ? ' freeform-problem-briefcase' : ''}${
        problemExpanded ? ' is-open' : ''
      }${problemHasProvenance ? ' has-provenance' : ''}`}
      style={{
        left: card.x,
        top: card.y,
        width: card.width,
        height: card.expanded ? card.height : 44,
      }}
      onPointerDownCapture={onCardPointerDownCapture}
      onPointerDown={(e) => {
        e.stopPropagation()
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onToggleExpand()
      }}
    >
      {card.kind === 'agent' ? (
        <div
          ref={headerRef}
          className="freeform-card-header freeform-card-header--agent"
          onPointerDown={onAgentHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          onPointerCancel={onHeaderPointerUp}
        >
          <div
            className="freeform-agent-drag-handle"
          >
            <span className="freeform-card-dot" style={{ background: card.color }} />
            <span className={titleFrameClass}>
              <span className="freeform-card-title">{card.title}</span>
            </span>
            {agentRunStatus ? (
              <span className={`freeform-run-pill${swarmRunIsActive(agentRunStatus) ? ' is-active' : ''}`}>
                {formatRunStatus(agentRunStatus)}
              </span>
            ) : null}
            {selected ? <span className="freeform-selection-badge">Selected</span> : null}
            {subagentCount > 0 ? (
              <span
                className="freeform-subagent-count-badge"
                title="Subagents nested under this board — drop more boards here to add capacity"
              >
                ↳{subagentCount}
              </span>
            ) : null}
          </div>
          {hasOpenQuestions && !card.expanded ? (
            <span
              className={`freeform-open-pin${isAgent ? ' freeform-open-pin-agent' : ''}`}
              title="Open questions — expand card"
            >
              ?
            </span>
          ) : null}
        </div>
      ) : (
        <div
          ref={headerRef}
          className="freeform-card-header"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          onPointerCancel={onHeaderPointerUp}
        >
          {card.kind === 'problem' ? <span className="freeform-briefcase-latch" aria-hidden="true" /> : null}
          <span className="freeform-card-dot" style={{ background: card.color }} />
          <span className={titleFrameClass}>
            <span className="freeform-card-title">{card.title}</span>
          </span>
          {card.kind === 'problem' ? <span className="freeform-briefcase-glow" aria-hidden="true" /> : null}
          {selected ? <span className="freeform-selection-badge">Selected</span> : null}
          {card.kind === 'problem' && swarmMass > 0 ? (
            <span className="freeform-swarm-mass-badge" title="Swarm mass — specialists on this hub">
              ×{swarmMass}
            </span>
          ) : null}
          {card.kind === 'problem' && !card.expanded ? (
            <span className="freeform-briefcase-pill" title="Closed briefcase">
              Briefcase
            </span>
          ) : null}
          {card.kind === 'problem' && problemSessionSummary ? (
            <span className={`freeform-session-pill is-${problemSessionSummary.readinessTone}`}>
              {problemSessionSummary.readinessLabel}
            </span>
          ) : null}
          {card.kind === 'problem' && problemRunStatus ? (
            <span className={`freeform-run-pill${swarmRunIsActive(problemRunStatus) ? ' is-active' : ''}`}>
              {formatRunStatus(problemRunStatus)}
            </span>
          ) : null}
          {hasOpenQuestions && !card.expanded ? (
            <span
              className={`freeform-open-pin${isAgent ? ' freeform-open-pin-agent' : ''}`}
              title="Open questions — expand card"
            >
              ?
            </span>
          ) : null}
        </div>
      )}
      {card.expanded ? (
        <div
          ref={
            card.kind === 'problem'
              ? problemBodyRef
              : showInlineAgentTerminal
                ? agentBodyRef
                : undefined
          }
          className={`freeform-card-body${card.kind === 'agent' ? ' freeform-card-body--agent' : ''}${
            showInlineAgentTerminal ? ' is-terminal' : ''
          }`}
          onPointerDown={showInlineAgentTerminal ? undefined : onBodyPointerDown}
          onPointerMove={showInlineAgentTerminal ? undefined : onHeaderPointerMove}
          onPointerUp={showInlineAgentTerminal ? undefined : onHeaderPointerUp}
          onPointerCancel={showInlineAgentTerminal ? undefined : onHeaderPointerUp}
        >
          {card.kind === 'problem' ? (
            <>
              <div className="freeform-briefcase-interior" aria-hidden="true">
                <span className="freeform-briefcase-beam" />
              </div>
              <div className="freeform-briefcase-perception-bar" role="toolbar" aria-label="Briefcase perception">
                {PROBLEM_PERCEPTION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`freeform-briefcase-perception-chip${
                      problemPerception === option.value ? ' is-active' : ''
                    }`}
                    aria-pressed={problemPerception === option.value}
                    onClick={(e) => {
                      e.stopPropagation()
                      setProblemPerception(option.value)
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.detail}</span>
                  </button>
                ))}
              </div>
              <div className="freeform-briefcase-grid" aria-label="Briefcase structure">
                {briefcasePanels.map((panel) => (
                  <article key={panel.kicker} className="freeform-briefcase-panel">
                    <span className="freeform-briefcase-panel-kicker">{panel.kicker}</span>
                    <strong>{panel.title}</strong>
                    <p>{panel.copy}</p>
                  </article>
                ))}
              </div>
              {problemPerception === 'panorama' ? (
                <div className="freeform-briefcase-panorama-layer">
                  {renderProblemSessionStrip()}
                  <div className="freeform-briefcase-story-band">
                    <div className="freeform-briefcase-story-panel">
                      <span className="freeform-briefcase-section-kicker">North star</span>
                      {renderMissionBlock()}
                    </div>
                    <div className="freeform-briefcase-story-panel">
                      <span className="freeform-briefcase-section-kicker">Live room</span>
                      <div className="freeform-briefcase-signal-grid">
                        <div className="freeform-briefcase-signal-tile">
                  <strong>{assignedAgents.length}</strong>
                          <span>terminals inside</span>
                        </div>
                        <div className="freeform-briefcase-signal-tile">
                          <strong>{opens.length}</strong>
                          <span>open knots</span>
                        </div>
                        <div className="freeform-briefcase-signal-tile">
                          <strong>{problemProvenanceCount}</strong>
                          <span>return traces</span>
                        </div>
                      </div>
                      {opens.length > 0 ? <OpenQuestionsBlock items={opens.slice(0, 2)} /> : null}
                    </div>
                  </div>
                </div>
              ) : problemPerception === 'close-read' ? (
                <div className="freeform-briefcase-detail-grid">
                  <div className="freeform-briefcase-detail-column">
                    {renderBriefHarness(true)}
                    {renderProblemRunSummary()}
                    {renderProblemSessionStrip()}
                    <OpenQuestionsBlock items={opens} />
                    <div className="freeform-briefcase-story-panel">
                      <span className="freeform-briefcase-section-kicker">Mission text</span>
                      {renderMissionBlock()}
                    </div>
                  </div>
                  <div className="freeform-briefcase-detail-column">
                    <div className="freeform-briefcase-story-panel">
                      <span className="freeform-briefcase-section-kicker">Execution terminals</span>
                      {renderAssignedAgents()}
                    </div>
                    <div className="freeform-briefcase-trace-grid">
                      <div className="freeform-briefcase-trace-card">
                        <span>Runs</span>
                        <strong>{runLedgerCount}</strong>
                      </div>
                      <div className="freeform-briefcase-trace-card">
                        <span>Anchors</span>
                        <strong>{memoryAnchorCount}</strong>
                      </div>
                      <div className="freeform-briefcase-trace-card">
                        <span>Assets</span>
                        <strong>{briefAssetCount}</strong>
                      </div>
                      <div className="freeform-briefcase-trace-card">
                        <span>Questions</span>
                        <strong>{opens.length}</strong>
                      </div>
                    </div>
                    {assignedAgents.length > 0 ? (
                      <div className="freeform-swarm-loop">
                        <div className="freeform-swarm-loop-title">Swarm loop</div>
                        <p>
                          Terminals attack the bottleneck in parallel, reconnect to the whole
                          problem after each chunk, and surface you only when they hit a real
                          decision.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <>
                  {renderBriefHarness(false)}
                  {renderProblemRunSummary()}
                  {renderProblemSessionStrip()}
                  <OpenQuestionsBlock items={opens} />
                  {renderMissionBlock()}
                  {renderAssignedAgents()}
                  {assignedAgents.length > 0 ? (
                    <div className="freeform-swarm-loop">
                      <div className="freeform-swarm-loop-title">Swarm loop</div>
                      <p>
                        Terminals attack the bottleneck in parallel, reconnect to the whole
                        problem after each chunk, and surface you only when they hit a real
                        decision.
                      </p>
                    </div>
                  ) : null}
                </>
              )}
              {assignedAgents.length > 0 ? (
                <div
                  className={`freeform-problem-lead-brief${
                    handshakeFocus?.problemId === card.id ? ' is-pulse' : ''
                  }`}
                >
                  <strong>Lead loop</strong> — Keep the swarm pointed at the choke point, then eject
                  finished terminals back to the surface so they are ready for the next problem.
                </div>
              ) : null}
              <div className="freeform-briefcase-footer">
                <span>{problemPerception === 'panorama' ? 'Big picture' : problemPerception === 'close-read' ? 'Close read' : 'Work surface'}</span>
                <span>
                  {problemHasProvenance
                    ? 'Recorded provenance available'
                    : 'Provenance records appear only when the work or evidence warrants it'}
                </span>
              </div>
            </>
          ) : card.kind === 'agent' ? showInlineAgentTerminal ? (
            <>
              <DewDropTerminalSurface
                agent={card}
                busy={agentTerminalBusy}
                onStart={onAgentTerminalStart ?? (() => undefined)}
                onStop={onAgentTerminalStop ?? (() => undefined)}
                onRefresh={onAgentTerminalRefresh ?? (() => undefined)}
                onReturnArtifact={onAgentTerminalReturnArtifact}
                onSendInput={onAgentTerminalSendInput}
                onResizeSession={onAgentTerminalResize}
              />
              <OpenQuestionsBlock items={opens} />
              {assignedProblem ? (
                <div className="freeform-release-row">
                  <button
                    type="button"
                    className={`freeform-mini-btn${card.releaseNodFromSpecialist ? ' is-on' : ''}`}
                    title="No useful work left — needs lead nod to leave the sack"
                    onClick={(e) => {
                      e.stopPropagation()
                      onReleaseNod(card.id, 'specialist')
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {card.releaseNodFromSpecialist ? '✓ I’m done here' : 'I’m done — no useful work'}
                  </button>
                  {card.releaseNodFromSpecialist && !card.releaseNodFromLead ? (
                    <span className="freeform-release-hint">Waiting for lead release on problem…</span>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <>
              {agentRunStatus ? (
                <div className="freeform-agent-run-summary">
                  <div className="freeform-problem-run-summary-head">
                    <strong>Current run</strong>
                    <span>{formatRunStatus(agentRunStatus)}</span>
                  </div>
                  <p>{agentRunSummary || 'Runtime state is attached to this terminal.'}</p>
                </div>
              ) : null}
              <OpenQuestionsBlock items={opens} />
              <p style={{ margin: '0 0 8px' }}>
                {card.parentAgentId
                  ? (() => {
                      const par = cards.find(
                        (x) => x.id === card.parentAgentId && x.kind === 'agent',
                      )
                      const parName = par?.title ?? 'parent terminal'
                      return assignedProblem
                        ? `Nested under “${parName}” inside “${assignedProblem.title}” — stay in the swarm until the lead releases you.`
                        : `Nested under “${parName}” — drag free when this branch is done.`
                    })()
                  : assignedProblem
                    ? `Working inside “${assignedProblem.title}” — overlap another terminal to grow a sub-swarm, or peel out when the work is done.`
                    : 'Free terminal — drag this into any problem bubble to deploy it.'}
              </p>
              {!assignedProblem && card.lastProjectRecall ? (
                <p className="freeform-recall-line">{card.lastProjectRecall}</p>
              ) : null}
              {assignedProblem ? (
                <div className="freeform-release-row">
                  <button
                    type="button"
                    className={`freeform-mini-btn${card.releaseNodFromSpecialist ? ' is-on' : ''}`}
                    title="No useful work left — needs lead nod to leave the sack"
                    onClick={(e) => {
                      e.stopPropagation()
                      onReleaseNod(card.id, 'specialist')
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {card.releaseNodFromSpecialist ? '✓ I’m done here' : 'I’m done — no useful work'}
                  </button>
                  {card.releaseNodFromSpecialist && !card.releaseNodFromLead ? (
                    <span className="freeform-release-hint">Waiting for lead release on problem…</span>
                  ) : null}
                </div>
              ) : null}
              {handshakeProblem ? (
                <div
                  className={`freeform-connect-handshake${handshakePulse ? ' is-pulse' : ''}`}
                  role="status"
                >
                  <p className="freeform-handshake-line">
                    <span className="freeform-handshake-role">Swarm</span>
                    Deployed into “{handshakeProblem.title}”.
                  </p>
                  <p className="freeform-handshake-line">
                    <span className="freeform-handshake-role">Lead</span>
                    Attack the current bottleneck, sync back to the whole goal when your chunk lands,
                    and escalate only when you hit a decision that needs oversight.
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <OpenQuestionsBlock items={opens} />
              <p style={{ margin: 0 }}>
                Generic surface for notes and links. Problems and terminals use swarm combine rules
                above.
              </p>
            </>
          )}
          <p style={{ margin: '10px 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>
            {card.kind === 'agent'
              ? showInlineAgentTerminal
                ? 'Drag the header to move it. The DewDrop body is the live terminal.'
                : 'Drag anywhere on the terminal to move it. Double-click to expand or collapse.'
              : 'Drag anywhere on the card to move it. Double-click to collapse.'}
          </p>
        </div>
      ) : null}
      <div
        className="freeform-card-resize-handle"
        title="Resize"
        aria-label="Resize card"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
      />
    </div>
  )
}
