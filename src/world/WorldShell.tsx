import { useEffect, useState, type CSSProperties } from 'react'
import { buildMediaRuntimeBlueprint } from '../lib/mediaRuntime'
import { RoomAssetStudio } from '../spatial/RoomAssetStudio'
import { buildRoomAssetFromSpatialContext } from '../spatial/roomAsset'
import { buildRoomAssetStudioAsset } from '../spatial/roomAssetStudioModel'
import type { SpatialRoomZoneId } from '../spatial/spatialRoom'
import { worldRef, type WorldRef } from './model'
import {
  buildRoomPalaceMapping,
  type RoomPalaceItem,
  type RoomPalaceItemKind,
  type RoomPalaceZoneId,
} from './roomPalace'
import { layoutRingNodes } from './spatialLayout'
import './world.css'

export type WorldHierarchy = {
  earth: string
  wing: string
  actor: string
  room: string
}

export type WorldProjectionTone = 'ready' | 'attention' | 'missing' | 'calm'

export type WorldProjectionChip = {
  id: string
  label: string
  detail: string
  tone?: WorldProjectionTone
}

export type WorldProjectionStageCard = {
  id: string
  title: string
  summary: string
  kind: string
  emphasis: 'focus' | 'related' | 'supporting'
  focusRef?: WorldRef
}

export type WorldProjectionStageLink = {
  id: string
  label: string
  detail: string
  kind: 'containment' | 'relationship' | 'tunnel' | 'reference'
  focusRef?: WorldRef
}

export type WorldProjectionStageItem = {
  id: string
  label: string
  focusRef?: WorldRef
  drillStageId?: WorldDrillStageId
}

export type WorldProjectionStageVector = {
  id: string
  label: string
  detail: string
  tone?: WorldProjectionTone
  orbit?: 'inner' | 'outer'
  focusRef?: WorldRef
  drillStageId?: WorldDrillStageId
}

export type WorldProjectionStage = {
  id: string
  modeLabel: string
  modeDetail: string
  focusTitle: string
  summary: string
  breadcrumb: string[]
  breadcrumbItems?: WorldProjectionStageItem[]
  stats: string[]
  cards: WorldProjectionStageCard[]
  links: WorldProjectionStageLink[]
  returnVectors?: WorldProjectionStageVector[]
  detailSections?: WorldProjectionStageSection[]
}

export type WorldProjectionStageSection = {
  id: string
  title: string
  copy?: string
  items?: WorldProjectionStageItem[]
  tone?: WorldProjectionTone
  style?: 'list' | 'bands' | 'packet'
}

export type WorldRoomCard = {
  id: string
  title: string
  summary: string
  meta?: string[]
  tone?: WorldProjectionTone
  accent?: string
}

export type WorldRoomPreview = {
  title: string
  summary: string
  surfaceLabel: string
  memoryLabel: string
  actorLabels: string[]
  actorItems?: WorldProjectionStageItem[]
  locusLabels: string[]
  locusItems?: WorldProjectionStageItem[]
  artifactLabels: string[]
  artifactItems?: WorldProjectionStageItem[]
  tunnelLabels: string[]
  tunnelItems?: WorldProjectionStageItem[]
  anchorLabels: string[]
  anchorItems?: WorldProjectionStageItem[]
  openQuestionLabels: string[]
  openQuestionItems?: WorldProjectionStageItem[]
  phoneBrief?: string
  desktopBrief?: string
  latestRunLabel?: string
}

export type WorldDrillStageId = 'earth' | 'wing' | 'room' | 'locus'

export type WorldDrillStage = {
  id: WorldDrillStageId
  label: string
  value: string
  detail: string
  disabled?: boolean
}

export type WorldLocusCard = {
  id: string
  title: string
  summary: string
  kindLabel: string
  roomLabel?: string
  actorLabels?: string[]
  artifactLabels?: string[]
  tone?: WorldProjectionTone
  accent?: string
}

export type WorldLocusPreview = {
  title: string
  summary: string
  kindLabel: string
  actorLabels: string[]
  actorItems?: WorldProjectionStageItem[]
  artifactLabels: string[]
  artifactItems?: WorldProjectionStageItem[]
}

export type WorldClosetCard = {
  id: string
  title: string
  summary: string
  sourceLabel: string
  drawers: WorldClosetDrawer[]
  tone?: WorldProjectionTone
  accent?: string
}

export type WorldClosetDrawer = {
  id: string
  label: string
  focusRef?: WorldRef
}

type WorldJumpTrailEntry = {
  id: string
  label: string
  detail: string
  focusRef?: WorldRef
  drillStageId?: WorldDrillStageId
}

export type WorldShellProps = {
  title: string
  subtitle?: string
  heroCopy?: string
  hierarchy: WorldHierarchy
  projectionChips?: WorldProjectionChip[]
  activeProjection?: WorldProjectionStage
  roomCards?: WorldRoomCard[]
  roomPreview?: WorldRoomPreview
  selectedProjectionId?: string | null
  selectedRoomId?: string | null
  drillStages?: WorldDrillStage[]
  selectedDrillStageId?: WorldDrillStageId | null
  locusCards?: WorldLocusCard[]
  selectedLocusId?: string | null
  locusPreview?: WorldLocusPreview
  closetCards?: WorldClosetCard[]
  selectedClosetId?: string | null
  onProjectionSelect?: (projectionId: string) => void
  onRoomSelect?: (roomId: string) => void
  onDrillStageSelect?: (stageId: WorldDrillStageId) => void
  onLocusSelect?: (locusId: string) => void
  onClosetSelect?: (closetId: string) => void
  onFocusRefSelect?: (focusRef: WorldRef) => void
  onOpenDesktop?: (roomId: string | null) => void
  onOpenPhoneRelay?: (roomId: string | null) => void
  arrivalMode?: 'auto' | 'always' | 'never'
  arrivalDurationMs?: number
  className?: string
}

function toneClass(tone?: WorldProjectionTone): string {
  if (tone === 'ready') return 'is-ready'
  if (tone === 'attention') return 'is-attention'
  if (tone === 'missing') return 'is-missing'
  if (tone === 'calm') return 'is-calm'
  return ''
}

function createDrillStages(
  hierarchy: WorldHierarchy,
  locusTitle?: string,
): WorldDrillStage[] {
  return [
    {
      id: 'earth',
      label: 'Earth',
      value: hierarchy.earth,
      detail: 'Planetary shell and return vector.',
    },
    {
      id: 'wing',
      label: 'Wing',
      value: hierarchy.wing,
      detail: `Actor anchor: ${hierarchy.actor}`,
    },
    {
      id: 'room',
      label: 'Room',
      value: hierarchy.room,
      detail: 'Focused operating surface and memory frame.',
    },
    {
      id: 'locus',
      label: 'Locus',
      value: locusTitle ?? 'Awaiting locus selection',
      detail: locusTitle
        ? 'Room interior anchor for precise context.'
        : 'Select a locus to open the room interior.',
      disabled: !locusTitle,
    },
  ]
}

function selectDefaultDrillStageId(
  drillStages: WorldDrillStage[],
  preferred: WorldDrillStageId,
): WorldDrillStageId | null {
  if (drillStages.some((stage) => stage.id === preferred && !stage.disabled)) {
    return preferred
  }

  return drillStages.find((stage) => !stage.disabled)?.id ?? drillStages[0]?.id ?? null
}

const scopeProjectionOrder = ['earth', 'wing'] as const
const ladderProjectionOrder = ['outline', 'fold', 'room', 'packet'] as const

function sortProjectionChips(
  chips: readonly WorldProjectionChip[],
  order: readonly string[],
): WorldProjectionChip[] {
  const ranking = new Map(order.map((id, index) => [id, index]))
  return [...chips].sort((left, right) => {
    const leftRank = ranking.get(left.id) ?? Number.MAX_SAFE_INTEGER
    const rightRank = ranking.get(right.id) ?? Number.MAX_SAFE_INTEGER
    return leftRank - rightRank
  })
}

function projectionSections(chips: readonly WorldProjectionChip[]) {
  const scopeIds = new Set<string>(scopeProjectionOrder)
  const ladderIds = new Set<string>(ladderProjectionOrder)

  return {
    scopeChips: sortProjectionChips(
      chips.filter((chip) => scopeIds.has(chip.id)),
      scopeProjectionOrder,
    ),
    ladderChips: sortProjectionChips(
      chips.filter((chip) => ladderIds.has(chip.id)),
      ladderProjectionOrder,
    ),
    otherChips: chips.filter((chip) => !scopeIds.has(chip.id) && !ladderIds.has(chip.id)),
  }
}

function jumpTrailDetail(projectionLabel: string | undefined, drillLabel: string | undefined): string {
  if (projectionLabel && drillLabel) return `${projectionLabel} projection · ${drillLabel} stage`
  if (projectionLabel) return `${projectionLabel} projection`
  if (drillLabel) return `${drillLabel} stage`
  return 'World focus'
}

function jumpFocusKindLabel(kind: WorldRef['kind']): string {
  if (kind === 'wing') return 'Wing'
  if (kind === 'person') return 'Person'
  if (kind === 'animal') return 'Animal'
  if (kind === 'plant') return 'Plant'
  if (kind === 'organization') return 'Organization'
  if (kind === 'agent') return 'Agent'
  if (kind === 'room') return 'Room'
  if (kind === 'locus') return 'Locus'
  return 'Artifact'
}

function buildJumpTrailEntry(options: {
  activeProjection?: WorldProjectionStage
  hierarchy: WorldHierarchy
  projectionLabel?: string
  currentDrillStageId: WorldDrillStageId | null
  selectedRoom?: WorldRoomCard | null
  selectedLocus?: WorldLocusCard | null
}): WorldJumpTrailEntry | null {
  const {
    activeProjection,
    hierarchy,
    projectionLabel,
    currentDrillStageId,
    selectedRoom,
    selectedLocus,
  } = options
  const drillLabel =
    currentDrillStageId === 'earth'
      ? 'Earth'
      : currentDrillStageId === 'wing'
        ? 'Wing'
        : currentDrillStageId === 'room'
          ? 'Room'
          : currentDrillStageId === 'locus'
            ? 'Locus'
            : undefined
  const detail = jumpTrailDetail(projectionLabel, drillLabel)
  const breadcrumbItems = activeProjection?.breadcrumbItems ?? []
  const wingItem =
    breadcrumbItems.find((item) => item.focusRef?.kind === 'wing') ??
    activeProjection?.returnVectors?.find((vector) => vector.focusRef?.kind === 'wing')
  const roomItem =
    breadcrumbItems.find((item) => item.focusRef?.kind === 'room') ??
    activeProjection?.returnVectors?.find((vector) => vector.focusRef?.kind === 'room')
  const locusItem =
    activeProjection?.returnVectors?.find((vector) => vector.focusRef?.kind === 'locus') ?? null

  if (currentDrillStageId === 'earth') {
    return {
      id: 'jump-earth',
      label: hierarchy.earth,
      detail,
      drillStageId: 'earth',
    }
  }

  if (currentDrillStageId === 'wing') {
    return {
      id: `jump-wing-${wingItem?.focusRef?.id ?? hierarchy.wing}`,
      label: wingItem?.label ?? hierarchy.wing,
      detail,
      focusRef: wingItem?.focusRef,
      drillStageId: wingItem?.focusRef ? undefined : 'wing',
    }
  }

  if (currentDrillStageId === 'locus' && selectedLocus) {
    return {
      id: `jump-locus-${selectedLocus.id}`,
      label: selectedLocus.title,
      detail,
      focusRef: locusItem?.focusRef ?? worldRef('locus', selectedLocus.id),
    }
  }

  if (selectedRoom) {
    return {
      id: `jump-room-${selectedRoom.id}`,
      label: roomItem?.label ?? selectedRoom.title,
      detail,
      focusRef: roomItem?.focusRef ?? worldRef('room', selectedRoom.id),
    }
  }

  if (currentDrillStageId === 'locus' && selectedLocus === null) {
    return {
      id: 'jump-locus-awaiting',
      label: 'Awaiting locus',
      detail,
      drillStageId: 'locus',
    }
  }

  return {
    id: 'jump-world',
    label: activeProjection?.focusTitle ?? hierarchy.room,
    detail,
  }
}

function jumpTrailKey(entry: WorldJumpTrailEntry): string {
  return `${entry.id}:${entry.detail}`
}

const roomPalaceZoneMeta: Record<
  RoomPalaceZoneId,
  {
    title: string
    copy: string
    area: string
  }
> = {
  door: {
    title: 'Door',
    copy: 'Entry, return, and room identity.',
    area: 'door',
  },
  table: {
    title: 'Work Table',
    copy: 'Active actors and live commitments.',
    area: 'table',
  },
  wall: {
    title: 'People Wall',
    copy: 'Anchors, relationships, and cross-room routes.',
    area: 'wall',
  },
  shelf: {
    title: 'Evidence Desk',
    copy: 'Artifacts, notes, and durable proof.',
    area: 'shelf',
  },
  drawer: {
    title: 'Drawer',
    copy: 'Folded questions and deferred details.',
    area: 'drawer',
  },
  window: {
    title: 'Future Window',
    copy: 'Forward briefs and next moves.',
    area: 'window',
  },
  floor: {
    title: 'Floor Walk',
    copy: 'The ordered locus route through the room.',
    area: 'floor',
  },
  console: {
    title: 'Control Surface',
    copy: 'Runs, automation, and execution state.',
    area: 'console',
  },
}

function extractPalaceLabel(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) return ''
  const arrowParts = trimmed.split('->')
  return arrowParts.at(-1)?.trim() || trimmed
}

function palaceKey(label: string): string {
  return extractPalaceLabel(label).toLowerCase()
}

function palaceLabels(
  items: readonly WorldProjectionStageItem[] | undefined,
  fallbackLabels: readonly string[],
): string[] {
  const source = items?.length ? items.map((item) => item.label) : fallbackLabels
  const labels: string[] = []
  const seen = new Set<string>()

  source.forEach((value) => {
    const normalized = extractPalaceLabel(value)
    const key = normalized.toLowerCase()
    if (!normalized || seen.has(key)) return
    seen.add(key)
    labels.push(normalized)
  })

  return labels
}

function palaceItemLookup(
  items: readonly WorldProjectionStageItem[] | undefined,
): Map<string, WorldProjectionStageItem> {
  const lookup = new Map<string, WorldProjectionStageItem>()

  items?.forEach((item) => {
    const key = palaceKey(item.label)
    if (!key || lookup.has(key)) return
    lookup.set(key, {
      ...item,
      label: extractPalaceLabel(item.label),
    })
  })

  return lookup
}

function presentValues(values: readonly (string | undefined)[]): string[] {
  return values.filter((value): value is string => Boolean(value))
}

export function WorldShell({
  title,
  subtitle = 'Context tunnel surface',
  heroCopy = 'A spatial operating surface where context travels from Earth to room without losing its shape.',
  hierarchy,
  projectionChips = [],
  activeProjection,
  roomCards = [],
  roomPreview,
  selectedProjectionId,
  selectedRoomId,
  drillStages = [],
  selectedDrillStageId,
  locusCards = [],
  selectedLocusId,
  locusPreview,
  closetCards = [],
  selectedClosetId,
  onProjectionSelect,
  onRoomSelect,
  onDrillStageSelect,
  onLocusSelect,
  onClosetSelect,
  onFocusRefSelect,
  onOpenDesktop,
  onOpenPhoneRelay,
  arrivalMode = 'auto',
  arrivalDurationMs = 2400,
  className,
}: WorldShellProps) {
  const [internalProjectionId, setInternalProjectionId] = useState<string | null>(
    selectedProjectionId ?? projectionChips[0]?.id ?? null,
  )
  const [internalRoomId, setInternalRoomId] = useState<string | null>(
    selectedRoomId ?? roomCards[0]?.id ?? null,
  )
  const [internalClosetId, setInternalClosetId] = useState<string | null>(
    selectedClosetId ?? closetCards[0]?.id ?? null,
  )
  const [roomDetailMode, setRoomDetailMode] = useState<'studio' | 'palace' | 'closets'>('studio')
  const [isArrivalVisible, setIsArrivalVisible] = useState(arrivalMode !== 'never')

  const stageCards = drillStages.length
    ? drillStages
    : createDrillStages(hierarchy, locusPreview?.title ?? locusCards[0]?.title)
  const { scopeChips, ladderChips, otherChips } = projectionSections(projectionChips)

  const currentProjectionId =
    selectedProjectionId !== undefined
      ? selectedProjectionId
      : projectionChips.some((chip) => chip.id === internalProjectionId)
        ? internalProjectionId
        : projectionChips[0]?.id ?? null
  const currentRoomId =
    selectedRoomId !== undefined
      ? selectedRoomId
      : roomCards.some((room) => room.id === internalRoomId)
        ? internalRoomId
        : roomCards[0]?.id ?? null
  const fallbackDrillStageId = selectDefaultDrillStageId(
    stageCards,
    locusPreview || locusCards.length > 0 ? 'locus' : 'room',
  )
  const currentDrillStageId =
    selectedDrillStageId !== undefined ? selectedDrillStageId : fallbackDrillStageId
  const currentLocusId = selectedLocusId !== undefined ? selectedLocusId : locusCards[0]?.id ?? null
  const defaultClosetId =
    closetCards.find((closet) => closet.id.startsWith('projection-'))?.id ??
    closetCards[0]?.id ??
    null
  const currentClosetId =
    selectedClosetId !== undefined
      ? selectedClosetId
      : closetCards.some((closet) => closet.id === internalClosetId)
        ? internalClosetId
        : defaultClosetId

  const selectedProjection =
    projectionChips.find((chip) => chip.id === currentProjectionId) ?? projectionChips[0] ?? null
  const selectedRoom = roomCards.find((room) => room.id === currentRoomId) ?? roomCards[0] ?? null
  const selectedDrillStage =
    stageCards.find((stage) => stage.id === currentDrillStageId) ??
    stageCards.find((stage) => !stage.disabled) ??
    stageCards[0] ??
    null
  const selectedLocus = locusCards.find((locus) => locus.id === currentLocusId) ?? locusCards[0] ?? null
  const selectedCloset =
    closetCards.find((closet) => closet.id === currentClosetId) ??
    closetCards.find((closet) => closet.id === defaultClosetId) ??
    closetCards[0] ??
    null
  const arrivalVisible = arrivalMode === 'never' ? false : isArrivalVisible
  const arrivalTargetTitle = activeProjection?.focusTitle ?? selectedRoom?.title ?? hierarchy.room
  const currentJumpEntry = buildJumpTrailEntry({
    activeProjection,
    hierarchy,
    projectionLabel: selectedProjection?.label ?? activeProjection?.modeLabel,
    currentDrillStageId,
    selectedRoom,
    selectedLocus,
  })
  const [jumpTrail, setJumpTrail] = useState<WorldJumpTrailEntry[]>(() =>
    currentJumpEntry ? [currentJumpEntry] : [],
  )
  const visibleJumpTrail = currentJumpEntry
    ? [
        ...jumpTrail.filter(
          (entry) => jumpTrailKey(entry) !== jumpTrailKey(currentJumpEntry),
        ),
        currentJumpEntry,
      ].slice(-5)
    : jumpTrail

  function rememberJumpEntry(entry: WorldJumpTrailEntry | null) {
    if (!entry) return
    setJumpTrail((current) => {
      const deduped = current.filter(
        (existing) => jumpTrailKey(existing) !== jumpTrailKey(entry),
      )
      return [...deduped, entry].slice(-5)
    })
  }

  function detailForJumpTarget(focusRef?: WorldRef, drillStageId?: WorldDrillStageId): string {
    const projectionLabel = selectedProjection?.label ?? activeProjection?.modeLabel
    if (drillStageId) {
      return jumpTrailDetail(projectionLabel, drillStageId[0].toUpperCase() + drillStageId.slice(1))
    }
    if (!focusRef) return jumpTrailDetail(projectionLabel, selectedDrillStage?.label)
    if (focusRef.kind === 'wing') return jumpTrailDetail(projectionLabel, 'Wing')
    if (focusRef.kind === 'room') return jumpTrailDetail(projectionLabel, 'Room')
    if (focusRef.kind === 'locus') return jumpTrailDetail(projectionLabel, 'Locus')
    if (focusRef.kind === 'artifact') return `${projectionLabel ?? 'World'} projection · Artifact focus`
    return `${projectionLabel ?? 'World'} projection · ${jumpFocusKindLabel(focusRef.kind)} focus`
  }

  function chooseProjection(projectionId: string) {
    rememberJumpEntry(
      buildJumpTrailEntry({
        activeProjection,
        hierarchy,
        projectionLabel:
          projectionChips.find((chip) => chip.id === projectionId)?.label ?? projectionId,
        currentDrillStageId,
        selectedRoom,
        selectedLocus,
      }),
    )
    if (selectedProjectionId === undefined) {
      setInternalProjectionId(projectionId)
    }
    onProjectionSelect?.(projectionId)
  }

  function chooseRoom(roomId: string) {
    rememberJumpEntry(
      buildJumpTrailEntry({
        activeProjection,
        hierarchy,
        projectionLabel: selectedProjection?.label ?? activeProjection?.modeLabel,
        currentDrillStageId: 'room',
        selectedRoom: roomCards.find((room) => room.id === roomId) ?? selectedRoom,
        selectedLocus: null,
      }),
    )
    if (selectedRoomId === undefined) {
      setInternalRoomId(roomId)
    }
    setRoomDetailMode('studio')
    onRoomSelect?.(roomId)
  }

  function chooseDrillStage(stage: WorldDrillStage) {
    if (stage.disabled) return
    rememberJumpEntry(
      buildJumpTrailEntry({
        activeProjection,
        hierarchy,
        projectionLabel: selectedProjection?.label ?? activeProjection?.modeLabel,
        currentDrillStageId: stage.id,
        selectedRoom,
        selectedLocus: stage.id === 'locus' ? selectedLocus : null,
      }),
    )
    onDrillStageSelect?.(stage.id)
  }

  function chooseLocus(locusId: string) {
    rememberJumpEntry(
      buildJumpTrailEntry({
        activeProjection,
        hierarchy,
        projectionLabel: selectedProjection?.label ?? activeProjection?.modeLabel,
        currentDrillStageId: 'locus',
        selectedRoom,
        selectedLocus: locusCards.find((locus) => locus.id === locusId) ?? selectedLocus,
      }),
    )
    onLocusSelect?.(locusId)
    if (!onLocusSelect) {
      onDrillStageSelect?.('locus')
    }
  }

  function chooseCloset(closetId: string) {
    if (selectedClosetId === undefined) {
      setInternalClosetId(closetId)
    }
    onClosetSelect?.(closetId)
  }

  function renderFocusItem(
    item: Pick<WorldProjectionStageItem, 'id' | 'label' | 'focusRef' | 'drillStageId'>,
    className: string,
  ) {
    const focusRef = item.focusRef
    if (focusRef && onFocusRefSelect) {
      return (
        <button
          key={item.id}
          type="button"
          className={className}
          onClick={() => {
            rememberJumpEntry({
              id: `jump-${item.id}`,
              label: item.label,
              detail: detailForJumpTarget(focusRef),
              focusRef,
            })
            onFocusRefSelect(focusRef)
          }}
        >
          {item.label}
        </button>
      )
    }
    if (item.drillStageId && onDrillStageSelect) {
      return (
        <button
          key={item.id}
          type="button"
          className={className}
          onClick={() => {
            rememberJumpEntry({
              id: `jump-${item.id}`,
              label: item.label,
              detail: detailForJumpTarget(undefined, item.drillStageId),
              drillStageId: item.drillStageId,
            })
            onDrillStageSelect(item.drillStageId!)
          }}
        >
          {item.label}
        </button>
      )
    }
    return <span key={item.id}>{item.label}</span>
  }

  function renderJumpTrailEntry(entry: WorldJumpTrailEntry, index: number, isCurrent: boolean) {
    const className = `world-shell-jump-node${isCurrent ? ' is-current' : ''}`
    const content = (
      <>
        <span className="world-shell-jump-index">{String(index + 1).padStart(2, '0')}</span>
        <div className="world-shell-jump-copy">
          <strong>{entry.label}</strong>
          <span>{entry.detail}</span>
        </div>
      </>
    )

    if (entry.focusRef && onFocusRefSelect) {
      return (
        <button
          key={jumpTrailKey(entry)}
          type="button"
          className={className}
          aria-pressed={isCurrent}
          onClick={() => {
            rememberJumpEntry(entry)
            onFocusRefSelect(entry.focusRef!)
          }}
        >
          {content}
        </button>
      )
    }

    if (entry.drillStageId && onDrillStageSelect) {
      return (
        <button
          key={jumpTrailKey(entry)}
          type="button"
          className={className}
          aria-pressed={isCurrent}
          onClick={() => {
            rememberJumpEntry(entry)
            onDrillStageSelect(entry.drillStageId!)
          }}
        >
          {content}
        </button>
      )
    }

    return (
      <div
        key={jumpTrailKey(entry)}
        className={className}
        aria-current={isCurrent ? 'true' : undefined}
      >
        {content}
      </div>
    )
  }

  function renderPreviewItems(
    items: readonly WorldProjectionStageItem[] | undefined,
    fallbackLabels: readonly string[],
    emptyLabel: string,
    keyPrefix: string,
  ) {
    const entries =
      items && items.length > 0
        ? items
        : fallbackLabels.map((label, index) => ({
            id: `${keyPrefix}-${index + 1}`,
            label,
          }))

    if (entries.length === 0) {
      return <span>{emptyLabel}</span>
    }

    return entries.map((item) => renderFocusItem(item, 'world-shell-meta-item-button'))
  }

  const zoomTunnelStages = stageCards
  const arrivalTopologyStages = stageCards.filter((stage) => !stage.disabled)
  const arrivalTopologyLayout = layoutRingNodes(
    arrivalTopologyStages.map((stage) => stage.id),
    {
      center: { x: 0, y: 0 },
      innerRadius: 96,
      outerRadius: 196,
      maxPerRing: Math.max(arrivalTopologyStages.length, 1),
      seed: `${title}:${arrivalTargetTitle}`,
    },
  )
  const arrivalTopologyNodeById = new Map(
    arrivalTopologyLayout.map((node) => [node.id, node]),
  )
  const palaceLocusItems =
    roomPreview?.locusItems && roomPreview.locusItems.length > 0
      ? roomPreview.locusItems
      : locusCards.map((locus) => ({
          id: `room-palace-locus-${locus.id}`,
          label: locus.title,
          focusRef: worldRef('locus', locus.id),
        }))
  const roomPalace =
    roomPreview
      ? buildRoomPalaceMapping({
          title: roomPreview.title,
          summary: roomPreview.summary,
          actors: palaceLabels(roomPreview.actorItems, roomPreview.actorLabels),
          loci: palaceLabels(palaceLocusItems, roomPreview.locusLabels),
          artifacts: palaceLabels(roomPreview.artifactItems, roomPreview.artifactLabels),
          tunnels: palaceLabels(roomPreview.tunnelItems, roomPreview.tunnelLabels),
          anchors: palaceLabels(roomPreview.anchorItems, roomPreview.anchorLabels),
          briefs: presentValues([roomPreview.phoneBrief, roomPreview.desktopBrief]),
          openQuestions: palaceLabels(
            roomPreview.openQuestionItems,
            roomPreview.openQuestionLabels,
          ),
          latestRun: roomPreview.latestRunLabel,
        })
      : null
  const roomPalaceRoomItems = roomPreview
    ? [
        currentRoomId
          ? {
              id: `room-palace-room-${currentRoomId}`,
              label: roomPreview.title,
              focusRef: worldRef('room', currentRoomId),
            }
          : {
              id: 'room-palace-room-current',
              label: roomPreview.title,
            },
      ]
    : undefined
  const roomPalaceLookup = {
    room: palaceItemLookup(roomPalaceRoomItems),
    actor: palaceItemLookup(roomPreview?.actorItems),
    locus: palaceItemLookup(palaceLocusItems),
    artifact: palaceItemLookup(roomPreview?.artifactItems),
    tunnel: palaceItemLookup(roomPreview?.tunnelItems),
    anchor: palaceItemLookup(roomPreview?.anchorItems),
    question: palaceItemLookup(roomPreview?.openQuestionItems),
  }
  const mediaRuntime =
    roomPreview
      ? buildMediaRuntimeBlueprint({
          roomTitle: roomPreview.title,
          surfaceLabel: roomPreview.surfaceLabel,
          hasPhoneBrief: !!roomPreview.phoneBrief?.trim(),
          hasDesktopBrief: !!roomPreview.desktopBrief?.trim(),
          hasLoci: palaceLocusItems.length > 0,
        })
      : null
  const roomAsset =
    roomPreview && mediaRuntime
      ? buildRoomAssetFromSpatialContext({
          title: roomPreview.title,
          summary: roomPreview.summary,
          memoryLabel: roomPreview.memoryLabel,
          surfaceLabel: roomPreview.surfaceLabel,
          captureLabel: mediaRuntime.captureLabel,
          editLabel: mediaRuntime.editLabel,
          actorLabels: palaceLabels(roomPreview.actorItems, roomPreview.actorLabels),
          locusLabels: palaceLabels(palaceLocusItems, roomPreview.locusLabels),
          artifactLabels: palaceLabels(roomPreview.artifactItems, roomPreview.artifactLabels),
          tunnelLabels: palaceLabels(roomPreview.tunnelItems, roomPreview.tunnelLabels),
          anchorLabels: palaceLabels(roomPreview.anchorItems, roomPreview.anchorLabels),
          briefLabels: presentValues([roomPreview.phoneBrief, roomPreview.desktopBrief]),
          openQuestionLabels: palaceLabels(
            roomPreview.openQuestionItems,
            roomPreview.openQuestionLabels,
          ),
          latestRunLabel: roomPreview.latestRunLabel,
        })
      : null
  const roomAssetStudioAsset =
    roomAsset && roomPreview && mediaRuntime
      ? buildRoomAssetStudioAsset(roomAsset, {
          roomLabel: hierarchy.wing,
          memoryLabel: roomPreview.memoryLabel,
          captureLabel: mediaRuntime.captureLabel,
          editLabel: mediaRuntime.editLabel,
          notes: presentValues([
            roomPreview.phoneBrief ? `Phone brief: ${roomPreview.phoneBrief}` : '',
            roomPreview.desktopBrief ? `Desktop brief: ${roomPreview.desktopBrief}` : '',
            roomPreview.latestRunLabel ? `Latest run: ${roomPreview.latestRunLabel}` : '',
          ]),
        })
      : null
  const hasStudioMode = !!roomAssetStudioAsset
  const hasPalaceMode = !!roomPalace
  const hasClosetMode = closetCards.length > 0
  const currentRoomDetailMode =
    roomDetailMode === 'studio' && hasStudioMode
      ? 'studio'
      : roomDetailMode === 'palace' && hasPalaceMode
        ? 'palace'
        : roomDetailMode === 'closets' && hasClosetMode
          ? 'closets'
          : hasStudioMode
            ? 'studio'
            : hasPalaceMode
              ? 'palace'
              : 'closets'

  function palaceFocusItemForKind(kind: RoomPalaceItemKind, label: string) {
    const key = palaceKey(label)
    if (!key) return undefined

    if (kind === 'room') return roomPalaceLookup.room.get(key)
    if (kind === 'actor') return roomPalaceLookup.actor.get(key)
    if (kind === 'locus') return roomPalaceLookup.locus.get(key)
    if (kind === 'artifact') return roomPalaceLookup.artifact.get(key)
    if (kind === 'tunnel') return roomPalaceLookup.tunnel.get(key)
    if (kind === 'anchor') return roomPalaceLookup.anchor.get(key)
    if (kind === 'question') return roomPalaceLookup.question.get(key)
    return undefined
  }

  function triggerFocusItem(
    focusItem: Pick<WorldProjectionStageItem, 'id' | 'label' | 'focusRef' | 'drillStageId'> | undefined,
  ) {
    if (!focusItem) return

    if (focusItem.focusRef && onFocusRefSelect) {
      rememberJumpEntry({
        id: `jump-${focusItem.id}`,
        label: focusItem.label,
        detail: detailForJumpTarget(focusItem.focusRef),
        focusRef: focusItem.focusRef,
      })
      onFocusRefSelect(focusItem.focusRef)
      return
    }

    if (focusItem.drillStageId && onDrillStageSelect) {
      rememberJumpEntry({
        id: `jump-${focusItem.id}`,
        label: focusItem.label,
        detail: detailForJumpTarget(undefined, focusItem.drillStageId),
        drillStageId: focusItem.drillStageId,
      })
      onDrillStageSelect(focusItem.drillStageId)
    }
  }

  function renderPalaceItem(item: RoomPalaceItem) {
    const focusItem = palaceFocusItemForKind(item.kind, item.label)
    const className = `world-shell-palace-item is-${item.kind}${focusItem ? ' is-interactive' : ''}`
    const content = (
      <>
        <strong>{item.label}</strong>
        <span>{item.detail}</span>
      </>
    )

    if (focusItem?.focusRef && onFocusRefSelect) {
      return (
        <button
          key={item.id}
          type="button"
          className={className}
          onClick={() => triggerFocusItem(focusItem)}
        >
          {content}
        </button>
      )
    }

    if (focusItem?.drillStageId && onDrillStageSelect) {
      return (
        <button
          key={item.id}
          type="button"
          className={className}
          onClick={() => triggerFocusItem(focusItem)}
        >
          {content}
        </button>
      )
    }

    return (
      <div key={item.id} className={className}>
        {content}
      </div>
    )
  }

  function focusItemForZone(zoneId: SpatialRoomZoneId) {
    if (zoneId === 'north_star' || zoneId === 'checkpoint') {
      return roomPalaceRoomItems?.[0]
    }
    if (zoneId === 'portal') {
      return roomPreview?.tunnelItems?.[0]
    }
    if (zoneId === 'door') {
      return roomPalaceRoomItems?.[0]
    }
    if (zoneId === 'table') {
      return roomPreview?.actorItems?.[0]
    }
    if (zoneId === 'wall') {
      return roomPreview?.tunnelItems?.[0] ?? roomPreview?.anchorItems?.[0]
    }
    if (zoneId === 'shelf') {
      return roomPreview?.artifactItems?.[0]
    }
    if (zoneId === 'drawer') {
      return roomPreview?.openQuestionItems?.[0]
    }
    if (zoneId === 'window') {
      return roomPreview?.tunnelItems?.[0] ?? roomPalaceRoomItems?.[0]
    }
    if (zoneId === 'floor') {
      return palaceLocusItems[0]
    }
    if (zoneId === 'console') {
      return roomPalaceRoomItems?.[0]
    }
    return undefined
  }

  useEffect(() => {
    if (arrivalMode === 'never') return

    const revealId = window.setTimeout(() => {
      setIsArrivalVisible(true)
    }, 0)
    const timeoutId = window.setTimeout(() => {
      setIsArrivalVisible(false)
    }, arrivalDurationMs)

    return () => {
      window.clearTimeout(revealId)
      window.clearTimeout(timeoutId)
    }
  }, [arrivalDurationMs, arrivalMode, title])

  return (
    <main className={`world-shell${className ? ` ${className}` : ''}`}>
      {arrivalVisible ? (
        <div className="world-shell-arrival-overlay" aria-label="Arrival transition">
          <div className="world-shell-arrival-topology">
            {arrivalTopologyStages.map((stage, index) => {
              const ringIndex = arrivalTopologyStages.length - index
              return (
                <div
                  key={stage.id}
                  className={`world-shell-arrival-ring${stage.id === currentDrillStageId ? ' is-active' : ''}`}
                  style={{ '--world-shell-arrival-ring-index': ringIndex } as CSSProperties}
                />
              )
            })}
            <div className="world-shell-arrival-target">
              <p className="world-shell-section-label">Destination</p>
              <strong>{arrivalTargetTitle}</strong>
              <span>{selectedProjection?.label ?? activeProjection?.modeLabel ?? 'World view'}</span>
            </div>
            {arrivalTopologyStages.map((stage) => {
              const node = arrivalTopologyNodeById.get(stage.id)
              const style = {
                '--world-shell-arrival-x': `${node?.x ?? 0}px`,
                '--world-shell-arrival-y': `${node?.y ?? 0}px`,
              } as CSSProperties
              return (
                <div
                  key={`topology-${stage.id}`}
                  className="world-shell-arrival-node-shell"
                  style={style}
                >
                  <div className={`world-shell-arrival-node${stage.id === currentDrillStageId ? ' is-active' : ''}`}>
                    <span>{stage.label}</span>
                    <strong>{stage.value}</strong>
                  </div>
                </div>
              )
            })}
            <div className="world-shell-arrival-vector" />
          </div>
          <div className="world-shell-arrival-copy" role="status" aria-live="polite">
            <p className="world-shell-kicker">Topology re-entry</p>
            <h2>Collapsing Earth into your current room</h2>
            <p className="world-shell-arrival-summary">
              {hierarchy.earth} to {arrivalTargetTitle}
            </p>
            <div className="world-shell-arrival-path">
              <span>{hierarchy.earth}</span>
              <span>{hierarchy.wing}</span>
              <span>{arrivalTargetTitle}</span>
              {selectedDrillStage ? <span>{selectedDrillStage.label}</span> : null}
            </div>
            <button
              type="button"
              className="world-shell-app-button"
              onClick={() => setIsArrivalVisible(false)}
            >
              Enter context now
            </button>
          </div>
        </div>
      ) : null}
      <section className="world-shell-hero">
        <div className="world-shell-hero-copy">
          <p className="world-shell-kicker">World shell</p>
          <h1>{title}</h1>
          <p className="world-shell-subtitle">{subtitle}</p>
          <p className="world-shell-hero-copy-text">{heroCopy}</p>
          <div className="world-shell-hero-metrics" aria-label="World metrics">
            <span>{roomCards.length} rooms</span>
            <span>{projectionChips.length} projections</span>
            {locusCards.length > 0 ? <span>{locusCards.length} loci</span> : null}
            {selectedRoom ? <span>Room: {selectedRoom.title}</span> : null}
            {selectedProjection ? <span>View: {selectedProjection.label}</span> : null}
            {selectedDrillStage ? <span>Stage: {selectedDrillStage.label}</span> : null}
          </div>
        </div>

        <div className="world-shell-planet-stage" aria-label="Projection stage">
          <div className="world-shell-orbit world-shell-orbit-one" />
          <div className="world-shell-orbit world-shell-orbit-two" />
          <div className="world-shell-planet-stage-head">
            <span className="world-shell-chip">Planetary shell</span>
            {activeProjection ? <span className="world-shell-chip">{activeProjection.modeLabel}</span> : null}
            {selectedDrillStage ? <span className="world-shell-chip">{selectedDrillStage.label} drill</span> : null}
          </div>
          <div className="world-shell-planet-stage-breadcrumb">
            {activeProjection?.breadcrumbItems?.length
              ? activeProjection.breadcrumbItems.map((item) =>
                  renderFocusItem(item, 'world-shell-planet-stage-breadcrumb-button'),
                )
              : (activeProjection?.breadcrumb ?? [hierarchy.earth, hierarchy.wing, hierarchy.room]).map((step) => (
                  <span key={step}>{step}</span>
                ))}
          </div>
          <div className="world-shell-planet-stage-grid">
            <div className="world-shell-planet-stage-copy">
              <div className="world-shell-vector-field" aria-label="Magnetic return vectors">
                <div className="world-shell-vector-rings">
                  <div className="world-shell-vector-ring world-shell-vector-ring-inner" />
                  <div className="world-shell-vector-ring world-shell-vector-ring-outer" />
                </div>
                {(activeProjection?.returnVectors ?? []).map((vector, index) => {
                  const total = Math.max((activeProjection?.returnVectors ?? []).length, 1)
                  const angle = -90 + (360 / total) * index
                  const ring = vector.orbit === 'inner' ? '36%' : '48%'
                  const style = {
                    '--world-shell-vector-angle': `${angle}deg`,
                    '--world-shell-vector-ring': ring,
                  } as CSSProperties
                  const action = renderFocusItem(vector, `world-shell-return-vector ${toneClass(vector.tone)} is-${vector.orbit ?? 'outer'}`)

                  if (typeof action.type === 'string' && action.type === 'span') {
                    return (
                      <div
                        key={vector.id}
                        className={`world-shell-return-vector ${toneClass(vector.tone)} is-${vector.orbit ?? 'outer'}`}
                        style={style}
                      >
                        <strong>{vector.label}</strong>
                        <span>{vector.detail}</span>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={vector.id}
                      className="world-shell-return-vector-shell"
                      style={style}
                    >
                      {action}
                      <span className="world-shell-return-vector-detail">{vector.detail}</span>
                    </div>
                  )
                })}
                <div className="world-shell-planet">
                  <span>Earth</span>
                  <strong>{hierarchy.earth}</strong>
                  <p>{activeProjection?.focusTitle ?? selectedRoom?.title ?? hierarchy.room}</p>
                </div>
              </div>
              <div className="world-shell-planet-caption">
                <strong>{activeProjection?.focusTitle ?? hierarchy.wing}</strong>
                <span>{activeProjection?.summary ?? hierarchy.actor}</span>
              </div>
              {activeProjection?.stats && activeProjection.stats.length > 0 ? (
                <div className="world-shell-planet-stage-stats">
                  {activeProjection.stats.map((item) => (
                    <span key={item} className="world-shell-chip">
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
              {zoomTunnelStages.length > 0 ? (
                <div className="world-shell-zoom-strip">
                  <div className="world-shell-zoom-strip-head">
                    <p className="world-shell-section-label">Zoom tunnel</p>
                    <span>
                      {selectedDrillStage?.label ?? 'World'} focus locked
                    </span>
                  </div>
                  <div className="world-shell-zoom-track" aria-label="Hero zoom tunnel">
                    {zoomTunnelStages.map((stage, index) => (
                      <button
                        key={stage.id}
                        type="button"
                        className={`world-shell-zoom-node${stage.id === currentDrillStageId ? ' is-selected' : ''}`}
                        onClick={() => chooseDrillStage(stage)}
                        aria-pressed={stage.id === currentDrillStageId}
                        disabled={stage.disabled}
                      >
                        <span className="world-shell-zoom-node-index">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="world-shell-zoom-node-copy">
                          <strong>{stage.label}</strong>
                          <span>{stage.value}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {visibleJumpTrail.length > 0 ? (
                <div className="world-shell-jump-rail">
                  <div className="world-shell-jump-rail-head">
                    <p className="world-shell-section-label">Return memory</p>
                    <span>{visibleJumpTrail.length} remembered re-entry points</span>
                  </div>
                  <div className="world-shell-jump-track" aria-label="Recent world jumps">
                    {visibleJumpTrail.map((entry, index) =>
                      renderJumpTrailEntry(entry, index, entry.id === currentJumpEntry?.id),
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="world-shell-stage-map">
              <div className="world-shell-stage-map-head">
                <div>
                  <p className="world-shell-section-label">Projection stage</p>
                  <h2>{activeProjection?.focusTitle ?? selectedRoom?.title ?? hierarchy.room}</h2>
                </div>
                {activeProjection ? (
                  <span className="world-shell-chip">{activeProjection.modeDetail}</span>
                ) : null}
              </div>

              <div className="world-shell-stage-node-grid">
                {(activeProjection?.cards ?? []).slice(0, 6).map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    className={`world-shell-stage-node is-${card.emphasis}`}
                    onClick={() => {
                      if (card.focusRef) {
                        onFocusRefSelect?.(card.focusRef)
                      }
                    }}
                    disabled={!card.focusRef || !onFocusRefSelect}
                    aria-label={`${card.title} ${card.summary}`}
                  >
                    <span className="world-shell-stage-node-kind">{card.kind}</span>
                    <strong>{card.title}</strong>
                    <p>{card.summary}</p>
                  </button>
                ))}
                {!activeProjection || activeProjection.cards.length === 0 ? (
                  <div className="world-shell-empty">
                    No projection cards yet. Select a room to populate this stage.
                  </div>
                ) : null}
              </div>

              {activeProjection?.links.length ? (
                <div className="world-shell-stage-links">
                  {activeProjection.links.slice(0, 5).map((link) => {
                    const focusRef = link.focusRef
                    if (focusRef && onFocusRefSelect) {
                      return (
                        <button
                          key={link.id}
                          type="button"
                          className={`world-shell-stage-link is-${link.kind}`}
                          onClick={() => onFocusRefSelect(focusRef)}
                        >
                          <strong>{link.label}</strong>
                          <span>{link.detail}</span>
                        </button>
                      )
                    }

                    return (
                      <div
                        key={link.id}
                        className={`world-shell-stage-link is-${link.kind}`}
                      >
                        <strong>{link.label}</strong>
                        <span>{link.detail}</span>
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {activeProjection?.detailSections?.length ? (
                <div className="world-shell-stage-sections">
                  {activeProjection.detailSections.map((section) => (
                    <article
                      key={section.id}
                      className={`world-shell-stage-section ${toneClass(section.tone)} is-${section.style ?? 'list'}`}
                    >
                      <div className="world-shell-stage-section-head">
                        <strong>{section.title}</strong>
                        {section.items?.length ? (
                          <span className="world-shell-chip">{section.items.length} items</span>
                        ) : null}
                      </div>
                      {section.copy ? <p>{section.copy}</p> : null}
                      {section.items?.length ? (
                        <ul className="world-shell-stage-section-list">
                          {section.items.map((item) => (
                            <li key={item.id}>
                              {(() => {
                                const focusRef = item.focusRef
                                if (focusRef && onFocusRefSelect) {
                                  return (
                                    <button
                                      type="button"
                                      className="world-shell-stage-section-item-button"
                                      onClick={() => onFocusRefSelect(focusRef)}
                                    >
                                      {item.label}
                                    </button>
                                  )
                                }
                                return <span>{item.label}</span>
                              })()}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="world-shell-panel" aria-label="Context tunnel">
        <div className="world-shell-panel-head">
          <div>
            <p className="world-shell-section-label">Context tunnel</p>
            <h2>Earth to room, without losing the fold</h2>
          </div>
          <div className="world-shell-panel-chip-row">
            <span className="world-shell-chip">{stageCards.length} stages</span>
            <span className="world-shell-chip">{selectedRoom?.summary ? 'Active room' : 'No room selected'}</span>
            {selectedDrillStage ? <span className="world-shell-chip">{selectedDrillStage.label} selected</span> : null}
          </div>
        </div>

        <nav className="world-shell-tunnel" aria-label="Context tunnel path">
          {stageCards.map((stage, index) => (
            <button
              key={stage.id}
              type="button"
              className={`world-shell-tunnel-step world-shell-tunnel-step-${stage.id}${
                stage.id === currentDrillStageId ? ' is-selected' : ''
              }`}
              onClick={() => chooseDrillStage(stage)}
              aria-pressed={stage.id === currentDrillStageId}
              disabled={stage.disabled}
            >
              <span className="world-shell-tunnel-index">{String(index + 1).padStart(2, '0')}</span>
              <div className="world-shell-tunnel-copy">
                <p>{stage.label}</p>
                <strong>{stage.value}</strong>
                <span className="world-shell-tunnel-detail">{stage.detail}</span>
              </div>
            </button>
          ))}
        </nav>

        {selectedDrillStage ? (
          <div className="world-shell-drill-readout" aria-label="Selected drill stage">
            <div>
              <p className="world-shell-section-label">Drill focus</p>
              <strong>{selectedDrillStage.value}</strong>
            </div>
            <p>{selectedDrillStage.detail}</p>
          </div>
        ) : null}

        <div className="world-shell-projection-section">
          <div className="world-shell-section-head">
            <div>
              <p className="world-shell-section-label">Projections</p>
              <h3>Unfold the same context through ordered views</h3>
            </div>
          </div>
          {projectionChips.length > 0 ? (
            <div className="world-shell-projection-stack">
              {scopeChips.length > 0 ? (
                <div className="world-shell-projection-scope">
                  <p className="world-shell-section-label">Spatial scale</p>
                  <div className="world-shell-projection-row" aria-label="Spatial projection chips">
                    {scopeChips.map((chip) => {
                      const selected = chip.id === currentProjectionId
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          className={`world-shell-projection-chip ${toneClass(chip.tone)}${selected ? ' is-selected' : ''}`}
                          onClick={() => chooseProjection(chip.id)}
                          aria-pressed={selected}
                        >
                          <strong>{chip.label}</strong>
                          <span>{chip.detail}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {ladderChips.length > 0 ? (
                <div className="world-shell-projection-ladder-block">
                  <div className="world-shell-projection-ladder-head">
                    <p className="world-shell-section-label">Unfold ladder</p>
                    <span className="world-shell-chip">
                      {selectedProjection?.label ?? 'Projection'} active
                    </span>
                  </div>
                  <div className="world-shell-projection-ladder" aria-label="Projection ladder">
                    {ladderChips.map((chip, index) => {
                      const selected = chip.id === currentProjectionId
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          className={`world-shell-projection-rung ${toneClass(chip.tone)}${selected ? ' is-selected' : ''}`}
                          onClick={() => chooseProjection(chip.id)}
                          aria-pressed={selected}
                        >
                          <span className="world-shell-projection-rung-index">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <div className="world-shell-projection-rung-copy">
                            <strong>{chip.label}</strong>
                            <span>{chip.detail}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {otherChips.length > 0 ? (
                <div className="world-shell-projection-row" aria-label="Additional projection chips">
                  {otherChips.map((chip) => {
                    const selected = chip.id === currentProjectionId
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        className={`world-shell-projection-chip ${toneClass(chip.tone)}${selected ? ' is-selected' : ''}`}
                        onClick={() => chooseProjection(chip.id)}
                        aria-pressed={selected}
                      >
                        <strong>{chip.label}</strong>
                        <span>{chip.detail}</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="world-shell-empty">No projections yet. Add 3D, fold, outline, or packet views.</div>
          )}
        </div>
      </section>

      <section className="world-shell-panel" aria-label="Room cards">
        <div className="world-shell-section-head">
          <div>
            <p className="world-shell-section-label">Rooms</p>
            <h2>Memorable places to work, remember, and move</h2>
          </div>
        </div>

        {roomCards.length > 0 ? (
          <div className="world-shell-room-grid">
            {roomCards.map((room) => {
              const selected = room.id === currentRoomId
              const accentStyle = room.accent
                ? ({ '--world-shell-accent': room.accent } as CSSProperties)
                : undefined

              return (
                <button
                  key={room.id}
                  type="button"
                  className={`world-shell-room-card ${toneClass(room.tone)}${selected ? ' is-selected' : ''}`}
                  style={accentStyle}
                  onClick={() => chooseRoom(room.id)}
                  aria-pressed={selected}
                >
                  <div className="world-shell-room-card-head">
                    <strong>{room.title}</strong>
                    <span className="world-shell-chip">Room</span>
                  </div>
                  <p>{room.summary}</p>
                  {room.meta && room.meta.length > 0 ? (
                    <div className="world-shell-room-meta">
                      {room.meta.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="world-shell-empty">No rooms yet. Create one to anchor a new context tunnel.</div>
        )}
      </section>

      {locusCards.length > 0 || locusPreview ? (
        <section className="world-shell-panel" aria-label="Loci">
          <div className="world-shell-section-head">
            <div>
              <p className="world-shell-section-label">Loci</p>
              <h2>Room interiors that hold the remembered compression</h2>
            </div>
            <div className="world-shell-panel-chip-row">
              {selectedLocus ? <span className="world-shell-chip">{selectedLocus.kindLabel}</span> : null}
              {selectedLocus ? <span className="world-shell-chip">{selectedLocus.roomLabel}</span> : null}
            </div>
          </div>

          <div className="world-shell-locus-layout">
            {locusCards.length > 0 ? (
              <div className="world-shell-locus-list" aria-label="Locus cards">
                {locusCards.map((locus) => {
                  const selected = locus.id === currentLocusId
                  const accentStyle = locus.accent
                    ? ({ '--world-shell-accent': locus.accent } as CSSProperties)
                    : undefined

                  return (
                    <button
                      key={locus.id}
                      type="button"
                      className={`world-shell-locus-card ${toneClass(locus.tone)}${selected ? ' is-selected' : ''}`}
                      style={accentStyle}
                      onClick={() => chooseLocus(locus.id)}
                      aria-pressed={selected}
                    >
                      <div className="world-shell-locus-card-head">
                        <div>
                          <p className="world-shell-section-label">Locus</p>
                          <strong>{locus.title}</strong>
                        </div>
                        <span className="world-shell-chip">{locus.kindLabel}</span>
                      </div>
                      <p>{locus.summary}</p>
                      <div className="world-shell-room-meta">
                        <span>{locus.roomLabel ?? selectedRoom?.title ?? 'Unassigned room'}</span>
                        <span>{locus.actorLabels?.length ?? 0} actors</span>
                        <span>{locus.artifactLabels?.length ?? 0} artifacts</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : null}

            {locusPreview ? (
              <article className="world-shell-locus-preview">
                <div className="world-shell-locus-preview-head">
                  <div>
                    <p className="world-shell-section-label">Locus detail</p>
                    <h2>{locusPreview.title}</h2>
                  </div>
                  <span className="world-shell-chip">{locusPreview.kindLabel}</span>
                </div>

                <p className="world-shell-room-preview-copy">{locusPreview.summary}</p>

                <div className="world-shell-room-preview-grid">
                  <article className="world-shell-room-preview-card">
                    <strong>Actors</strong>
                    <div className="world-shell-room-meta">
                      {renderPreviewItems(
                        locusPreview.actorItems,
                        locusPreview.actorLabels,
                        'No actors in this locus yet',
                        'locus-preview-actor',
                      )}
                    </div>
                  </article>

                  <article className="world-shell-room-preview-card">
                    <strong>Artifacts</strong>
                    <div className="world-shell-room-meta">
                      {renderPreviewItems(
                        locusPreview.artifactItems,
                        locusPreview.artifactLabels,
                        'No artifacts in this locus yet',
                        'locus-preview-artifact',
                      )}
                    </div>
                  </article>
                </div>
              </article>
            ) : (
              <div className="world-shell-empty">
                Select a locus to inspect the room interior and the actors or artifacts attached to it.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {roomPreview ? (
        <section className="world-shell-panel" aria-label="Selected room detail">
          <div className="world-shell-section-head">
            <div>
              <p className="world-shell-section-label">Room detail</p>
              <h2>{roomPreview.title}</h2>
            </div>
            <div className="world-shell-panel-chip-row">
              <span className="world-shell-chip">{roomPreview.surfaceLabel}</span>
              <span className="world-shell-chip">{roomPreview.memoryLabel}</span>
              {roomPreview.latestRunLabel ? (
                <span className="world-shell-chip">{roomPreview.latestRunLabel}</span>
              ) : null}
            </div>
          </div>

          <article className="world-shell-room-summary-card">
            <div className="world-shell-room-summary-copy">
              <p className="world-shell-section-label">Room summary</p>
              <p className="world-shell-room-preview-copy">{roomPreview.summary}</p>
            </div>
            <div className="world-shell-room-summary-meta">
              <span>{roomPreview.memoryLabel}</span>
              <span>{roomPalace?.counts.actors ?? 0} actors</span>
              <span>{roomPalace?.counts.artifacts ?? 0} artifacts</span>
              <span>{roomPalace?.counts.tunnels ?? 0} tunnels</span>
            </div>
            <div className="world-shell-room-actions">
              {onOpenDesktop ? (
                <button
                  type="button"
                  className="world-shell-app-button is-primary"
                  onClick={() => onOpenDesktop(currentRoomId)}
                >
                  Enter desktop room
                </button>
              ) : null}
              {onOpenPhoneRelay ? (
                <button
                  type="button"
                  className="world-shell-app-button"
                  onClick={() => onOpenPhoneRelay(currentRoomId)}
                >
                  Open phone relay
                </button>
              ) : null}
            </div>
          </article>

          <div className="world-shell-room-mode-row" aria-label="Room detail modes">
            <button
              type="button"
              className={`world-shell-room-mode-button${currentRoomDetailMode === 'studio' ? ' is-selected' : ''}`}
              onClick={() => setRoomDetailMode('studio')}
              aria-pressed={currentRoomDetailMode === 'studio'}
              disabled={!hasStudioMode}
            >
              Studio
            </button>
            <button
              type="button"
              className={`world-shell-room-mode-button${currentRoomDetailMode === 'palace' ? ' is-selected' : ''}`}
              onClick={() => setRoomDetailMode('palace')}
              aria-pressed={currentRoomDetailMode === 'palace'}
              disabled={!hasPalaceMode}
            >
              Palace
            </button>
            <button
              type="button"
              className={`world-shell-room-mode-button${currentRoomDetailMode === 'closets' ? ' is-selected' : ''}`}
              onClick={() => setRoomDetailMode('closets')}
              aria-pressed={currentRoomDetailMode === 'closets'}
              disabled={!hasClosetMode}
            >
              Closets
            </button>
          </div>

          {currentRoomDetailMode === 'studio' && roomAssetStudioAsset ? (
            <div className="world-shell-room-asset-studio">
              <RoomAssetStudio
                asset={roomAssetStudioAsset}
                onZoneSelect={(zoneId) => triggerFocusItem(focusItemForZone(zoneId as SpatialRoomZoneId))}
              />
            </div>
          ) : null}

          {currentRoomDetailMode === 'palace' && roomPalace ? (
            <div className="world-shell-memory-field" aria-label="Room memory field">
              <div className="world-shell-memory-field-head">
                <div>
                  <p className="world-shell-section-label">Room interior</p>
                  <h3>North Star and fixed loci</h3>
                </div>
                <span className="world-shell-chip">
                  {roomPalace.counts.loci} loci in the walk
                </span>
              </div>

              <div className="world-shell-palace-layout">
                <article className="world-shell-palace-north-star">
                  <div className="world-shell-palace-north-star-head">
                    <div>
                      <p className="world-shell-section-label">North Star</p>
                      <h4>{roomPalace.title}</h4>
                    </div>
                    <span className="world-shell-chip">{roomPreview.surfaceLabel}</span>
                  </div>
                  <p>{roomPalace.summary}</p>
                  <div className="world-shell-room-meta">
                    <span>{roomPreview.memoryLabel}</span>
                    <span>{roomPalace.counts.actors} actors</span>
                    <span>{roomPalace.counts.artifacts} artifacts</span>
                    <span>{roomPalace.counts.tunnels} tunnels</span>
                  </div>
                </article>

                <article className="world-shell-palace-checkpoint">
                  <div className="world-shell-palace-checkpoint-head">
                    <div>
                      <p className="world-shell-section-label">Phone Checkpoint</p>
                      <h4>Relay the room without losing the fold</h4>
                    </div>
                    {roomPreview.latestRunLabel ? (
                      <span className="world-shell-chip">{roomPreview.latestRunLabel}</span>
                    ) : null}
                  </div>
                  <div className="world-shell-palace-checkpoint-copy">
                    <p>Phone: {roomPreview.phoneBrief ?? 'No phone brief yet.'}</p>
                    <p>Desktop: {roomPreview.desktopBrief ?? 'No desktop brief yet.'}</p>
                  </div>
                </article>

                <div className="world-shell-palace-grid">
                  {roomPalace.zones.map((zone) => {
                    const zoneMeta = roomPalaceZoneMeta[zone.id]
                    return (
                      <article
                        key={zone.id}
                        className={`world-shell-palace-zone world-shell-palace-zone-${zoneMeta.area} ${toneClass(zone.tone)}`}
                      >
                        <div className="world-shell-palace-zone-head">
                          <div>
                            <p className="world-shell-section-label">{zoneMeta.title}</p>
                            <strong>{zoneMeta.copy}</strong>
                          </div>
                          <span className="world-shell-chip">{zone.items.length}</span>
                        </div>
                        <p className="world-shell-palace-zone-summary">{zone.summary}</p>
                        <div className="world-shell-palace-zone-items">
                          {zone.items.length > 0 ? (
                            zone.items.map((item) => renderPalaceItem(item))
                          ) : (
                            <div className="world-shell-palace-empty">{zone.emptyLabel}</div>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {currentRoomDetailMode === 'closets' ? (
            <div className="world-shell-closet-layout">
              {closetCards.length > 0 ? (
                <>
                  <div className="world-shell-closet-rail" aria-label="Closets and drawers">
                    {closetCards.map((closet) => {
                      const selected = closet.id === currentClosetId
                      const accentStyle = closet.accent
                        ? ({ '--world-shell-accent': closet.accent } as CSSProperties)
                        : undefined

                      return (
                        <button
                          key={closet.id}
                          type="button"
                          className={`world-shell-closet-card ${toneClass(closet.tone)}${selected ? ' is-selected' : ''}`}
                          style={accentStyle}
                          onClick={() => chooseCloset(closet.id)}
                          aria-pressed={selected}
                        >
                          <div className="world-shell-closet-card-head">
                            <div>
                              <p className="world-shell-section-label">Closet</p>
                              <strong>{closet.title}</strong>
                            </div>
                            <span className="world-shell-chip">{closet.sourceLabel}</span>
                          </div>
                          <p>{closet.summary}</p>
                          <div className="world-shell-room-meta">
                            <span>{closet.drawers.length} drawers</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {selectedCloset ? (
                    <article className="world-shell-closet-preview">
                      <div className="world-shell-closet-preview-head">
                        <div>
                          <p className="world-shell-section-label">Drawer preview</p>
                          <h3>{selectedCloset.title}</h3>
                        </div>
                        <span className="world-shell-chip">{selectedCloset.sourceLabel}</span>
                      </div>
                      <p>{selectedCloset.summary}</p>
                      {selectedCloset.drawers.length > 0 ? (
                        <ul className="world-shell-closet-drawer-list">
                          {selectedCloset.drawers.map((drawer) => (
                            <li key={drawer.id}>
                              {(() => {
                                const focusRef = drawer.focusRef
                                if (focusRef && onFocusRefSelect) {
                                  return (
                                    <button
                                      type="button"
                                      className="world-shell-closet-drawer-button"
                                      onClick={() => onFocusRefSelect(focusRef)}
                                    >
                                      {drawer.label}
                                    </button>
                                  )
                                }
                                return <span>{drawer.label}</span>
                              })()}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="world-shell-empty">No drawers in this closet yet.</div>
                      )}
                    </article>
                  ) : null}
                </>
              ) : (
                <div className="world-shell-empty">No closets or drawers mapped for this room yet.</div>
              )}
            </div>
          ) : null}

        </section>
      ) : null}
    </main>
  )
}
