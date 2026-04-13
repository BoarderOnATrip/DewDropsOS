import { useRef } from 'react'
import { flushSync } from 'react-dom'
import type { PointerEvent } from 'react'
import { countSubagents } from '../cardOverlap'
import { descendantHasOpenQuestions, openQuestionsForCard } from '../openQuestions'
import { pointerEventTargetEl } from '../pointerDom'
import { formatRunStatus, swarmRunIsActive } from '../runFormat'
import { swarmMassForProblem } from '../swarmAgents'
import type { BoardCamera, BoardWire, WorkflowCard } from '../types'
import { OpenQuestionsBlock } from './OpenQuestionsBlock'

export type CardViewProps = {
  card: WorkflowCard
  cards: WorkflowCard[]
  wires: BoardWire[]
  handshakeFocus: { agentId: string; problemId: string } | null
  selected: boolean
  camera: BoardCamera
  problemRunStatus?: string
  problemRunSummary?: string
  problemRunId?: string
  agentRunStatus?: string
  agentRunSummary?: string
  onSelect: (shiftKey?: boolean) => void
  onMove: (x: number, y: number) => void
  onResize: (width: number, height: number) => void
  onDragEnd: () => void
  onToggleExpand: () => void
  onReleaseNod: (agentId: string, which: 'specialist' | 'lead') => void
  /** Agent only: expand + grow body for reading when user clicks the body (not header). */
  onMakeAgentReadable?: () => void
  /** Pause hub overlap ejection while this card is being moved or resized. */
  onMarkUserMovingCard?: () => void
  /** First contact on card — pause overlap sim before drag/selection handlers run. */
  onCardPointerSession?: () => void
  /** Dev trace for pointer/selection routing. */
  onTrace?: (label: string, detail: string) => void
}

export function WorkflowCardView({
  card,
  cards,
  wires,
  handshakeFocus,
  selected,
  camera,
  problemRunStatus,
  problemRunSummary,
  problemRunId,
  agentRunStatus,
  agentRunSummary,
  onSelect,
  onMove,
  onResize,
  onDragEnd,
  onToggleExpand,
  onReleaseNod,
  onMakeAgentReadable,
  onMarkUserMovingCard,
  onCardPointerSession,
  onTrace,
}: CardViewProps) {
  const drag = useRef<{
    sx: number
    sy: number
    cx: number
    cy: number
    moved: boolean
    source: 'header' | 'body'
  } | null>(null)
  const resize = useRef<{ sx: number; sy: number; w: number; h: number } | null>(null)
  const agentDragHandleRef = useRef<HTMLDivElement>(null)
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
    captureEl.setPointerCapture(e.pointerId)
  }

  const onAgentBodyPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    const el = pointerEventTargetEl(e)
    if (!el) return
    if (el.closest('button, a, [role="button"]')) return
    onTrace?.('card.body.pointerdown', `${card.id} body`)
    e.stopPropagation()
    if (selected) {
      beginDrag(e, 'body', e.currentTarget as HTMLElement)
      return
    }
    onMakeAgentReadable?.()
  }

  /** Problem / surface: whole header drags; selection comes from card capture. */
  const onHeaderPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || resize.current) return
    const el = pointerEventTargetEl(e)
    if (!el) return
    onTrace?.('card.header.pointerdown', `${card.id} header`)
    e.stopPropagation()
    beginDrag(e, 'header', e.currentTarget as HTMLElement)
  }

  const onAgentHeaderPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || resize.current) return
    const el = pointerEventTargetEl(e)
    if (!el) return
    onTrace?.('card.agentHeader.pointerdown', `${card.id} agent-header`)
    e.stopPropagation()
    if (el.closest('.freeform-agent-drag-handle') && agentDragHandleRef.current) {
      beginDrag(e, 'header', agentDragHandleRef.current)
    }
  }

  const selectNow = (shiftKey?: boolean) => {
    flushSync(() => onSelect(shiftKey))
  }

  /** Pointer-down on a card selects it. Empty-canvas pointer-down starts marquee. */
  const shouldIgnoreSelectTarget = (el: Element | null) => {
    if (!el) return true
    if (el.closest('button, a, [role="button"]')) return true
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
      return
    }
    if (activeDrag.source === 'body') {
      onMakeAgentReadable?.()
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
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
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

  const titleFrameClass =
    card.kind === 'agent'
      ? 'freeform-card-title-frame freeform-card-title-frame--agent'
      : card.kind === 'problem'
        ? 'freeform-card-title-frame freeform-card-title-frame--problem'
        : 'freeform-card-title-frame freeform-card-title-frame--surface'

  return (
    <div
      data-board-card={card.id}
      className={`freeform-card${kindClass}${assignedClass}${nestedClass}${subtreeClass}${
        problemBubble ? ' freeform-problem-bubble' : ''
      }${card.kind === 'problem' && swarmMass > 0 ? ' freeform-problem-swarm-active' : ''}${
        swarmLinked ? ' freeform-agent-swarm-linked' : ''
      }${selected ? ' selected' : ''}${showGlobalOpenFlash ? ' has-open-questions' : ''}${agentGlowClass}${
        card.expanded ? '' : ' collapsed'
      }`}
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
        <div className="freeform-card-header freeform-card-header--agent" onPointerDown={onAgentHeaderPointerDown}>
          <div
            ref={agentDragHandleRef}
            className="freeform-agent-drag-handle"
            onPointerMove={onHeaderPointerMove}
            onPointerUp={onHeaderPointerUp}
            onPointerCancel={onHeaderPointerUp}
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
          className="freeform-card-header"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          onPointerCancel={onHeaderPointerUp}
        >
          <span className="freeform-card-dot" style={{ background: card.color }} />
          <span className={titleFrameClass}>
            <span className="freeform-card-title">{card.title}</span>
          </span>
          {selected ? <span className="freeform-selection-badge">Selected</span> : null}
          {card.kind === 'problem' && swarmMass > 0 ? (
            <span className="freeform-swarm-mass-badge" title="Swarm mass — specialists on this hub">
              ×{swarmMass}
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
          className={`freeform-card-body${card.kind === 'agent' ? ' freeform-card-body--agent' : ''}`}
          onPointerDown={card.kind === 'agent' ? onAgentBodyPointerDown : undefined}
          onPointerMove={card.kind === 'agent' ? onHeaderPointerMove : undefined}
          onPointerUp={card.kind === 'agent' ? onHeaderPointerUp : undefined}
          onPointerCancel={card.kind === 'agent' ? onHeaderPointerUp : undefined}
        >
          {card.kind === 'problem' ? (
            <>
              {problemRunStatus ? (
                <div className="freeform-problem-run-summary">
                  <div className="freeform-problem-run-summary-head">
                    <strong>Latest run</strong>
                    {problemRunId ? <span>{problemRunId.slice(-6)}</span> : null}
                  </div>
                  <p>{problemRunSummary || 'Run launched from Butler. Report pending.'}</p>
                </div>
              ) : null}
              <OpenQuestionsBlock items={opens} />
              {card.mission ? (
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: '0.78rem',
                    lineHeight: 1.48,
                    color: 'rgba(255,255,255,0.78)',
                  }}
                >
                  {card.mission.split(/\n\n+/).map((para, i) => (
                    <p key={i} style={{ margin: i === 0 ? '0 0 0.55em' : '0.55em 0 0' }}>
                      {para}
                    </p>
                  ))}
                </div>
              ) : (
                <p style={{ margin: '0 0 8px' }}>
                  Keep the goal, constraints, and next decision here. Drop agents into this problem
                  and the swarm forms around the bottleneck automatically.
                </p>
              )}
              {assignedAgents.length ? (
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                    Combined agents
                  </div>
                  {assignedAgents.map((a) => (
                    <div key={a.id} className="freeform-agent-pill freeform-agent-pill-with-actions">
                      <span className="dot" style={{ background: a.color }} />
                      <span className="freeform-agent-pill-label">
                        {a.title}
                      </span>
                      <button
                        type="button"
                        className={`freeform-mini-btn${a.releaseNodFromLead ? ' is-on' : ''}`}
                        title="Lead agrees this marble can leave the sack (needs specialist nod too)"
                        onClick={(e) => {
                          e.stopPropagation()
                          onReleaseNod(a.id, 'lead')
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {a.releaseNodFromLead ? 'Lead ✓ release' : 'Lead: release'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.38)' }}>
                  No agents in the swarm yet. Double-click empty space to summon one, then drop it
                  into this bubble and let the envelope pull it in.
                </p>
              )}
              {assignedAgents.length > 0 ? (
                <div className="freeform-swarm-loop">
                  <div className="freeform-swarm-loop-title">Swarm loop</div>
                  <p>
                    Agents attack the bottleneck in parallel, reconnect to the whole problem after
                    each chunk, and surface you only when they hit a real decision.
                  </p>
                </div>
              ) : null}
              {assignedAgents.length > 0 ? (
                <div
                  className={`freeform-problem-lead-brief${
                    handshakeFocus?.problemId === card.id ? ' is-pulse' : ''
                  }`}
                >
                  <strong>Lead loop</strong> — Keep the swarm pointed at the choke point, then eject
                  finished agents back to the surface so they are ready for the next problem.
                </div>
              ) : null}
            </>
          ) : card.kind === 'agent' ? (
            <>
              {agentRunStatus ? (
                <div className="freeform-agent-run-summary">
                  <div className="freeform-problem-run-summary-head">
                    <strong>Current run</strong>
                    <span>{formatRunStatus(agentRunStatus)}</span>
                  </div>
                  <p>{agentRunSummary || 'Runtime state is attached to this marble.'}</p>
                </div>
              ) : null}
              <OpenQuestionsBlock items={opens} />
              <p style={{ margin: '0 0 8px' }}>
                {card.parentAgentId
                  ? (() => {
                      const par = cards.find(
                        (x) => x.id === card.parentAgentId && x.kind === 'agent',
                      )
                      const parName = par?.title ?? 'parent board'
                      return assignedProblem
                        ? `Nested under “${parName}” inside “${assignedProblem.title}” — stay in the swarm until the lead releases you.`
                        : `Nested under “${parName}” — drag free when this branch is done.`
                    })()
                  : assignedProblem
                    ? `Working inside “${assignedProblem.title}” — overlap another agent to grow a sub-swarm, or peel out when the work is done.`
                    : 'Free marble — drag this into any problem bubble to deploy it.'}
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
                Generic surface for notes and links. Problems and agents use swarm combine rules
                above.
              </p>
            </>
          )}
          <p style={{ margin: '10px 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>
            {card.kind === 'agent'
              ? 'Drag the top strip to move. Once selected, you can drag from the body too. Tap the body to open it up. Double-click to collapse.'
              : 'Drag the header to move. Double-click to collapse.'}
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
