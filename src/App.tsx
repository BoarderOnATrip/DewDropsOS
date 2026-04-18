import { useCallback, useEffect, useMemo, useState } from 'react'
import ErrorBoundary from './ErrorBoundary'
import {
  buildRouteSearch,
  normalizeProjection,
  normalizeRoute,
  readRoute,
  type AppRoute,
} from './appRoute'
import BoardView from './freeform/BoardView'
import {
  buildBoardPayload,
  createPersistedWorkspace,
  deletePersistedWorkspace,
  duplicatePersistedWorkspace,
  getActiveWorkspaceId,
  listPersistedWorkspaces,
  loadPersistedWorkspace,
  renamePersistedWorkspace,
  setActiveWorkspaceId,
  subscribeToWorkspaceStore,
  updatePersistedWorkspaceFocus,
  updatePersistedWorkspaceProjection,
  updatePersistedWorkspaceSurface,
  type PersistedWorkspaceRecord,
} from './freeform/persistBoard'
import { hedgerowsDeltaSquadCards } from './freeform/presets/hedgerowsDeltaSquad'
import { PhoneRelayShell, buildPhoneRelayShellData } from './phone'
import {
  getButlerBridgeHealth,
  listSwarmRuns,
  loadButlerBridgeSettings,
  type ButlerBridgeHealth,
  type ButlerSwarmRun,
} from './lib/butlerBridge'
import {
  WorldShell,
  buildWorldIndex,
  buildWorldShellData,
  buildWorkspaceWorldGraph,
  worldRef,
  type WorldRef,
} from './world'

function buildSeedBoard() {
  return buildBoardPayload(
    { x: 0, y: 0, zoom: 0.78 },
    hedgerowsDeltaSquadCards(),
    [],
  )
}

function ensureWorkspaceExists(): PersistedWorkspaceRecord {
  const activeWorkspaceId = getActiveWorkspaceId()
  if (activeWorkspaceId) {
    const activeWorkspace = loadPersistedWorkspace(activeWorkspaceId)
    if (activeWorkspace) return activeWorkspace
  }

  const firstWorkspace = listPersistedWorkspaces()[0]
  if (firstWorkspace) {
    const loaded = loadPersistedWorkspace(firstWorkspace.id)
    if (loaded) {
      setActiveWorkspaceId(loaded.id)
      return loaded
    }
  }

  return createPersistedWorkspace('Primary workspace', buildSeedBoard())
}

function writeRoute(route: AppRoute): void {
  if (typeof window === 'undefined') return

  const nextSearch = buildRouteSearch(route)
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
  window.history.replaceState({}, '', nextUrl)
}

export default function App() {
  const ensuredWorkspace = ensureWorkspaceExists()
  const [storeVersion, setStoreVersion] = useState(0)
  const [route, setRoute] = useState<AppRoute>(() =>
    readRoute(typeof window === 'undefined' ? '' : window.location.search, {
      fallbackWorkspaceId: ensuredWorkspace.id,
      fallbackSurface: 'desktop',
    }),
  )
  const [phoneBridgeHealth, setPhoneBridgeHealth] = useState<ButlerBridgeHealth | null>(null)
  const [phoneRuns, setPhoneRuns] = useState<ButlerSwarmRun[]>([])

  useEffect(() => subscribeToWorkspaceStore(() => setStoreVersion((value) => value + 1)), [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const onPopState = () => {
      const fallbackWorkspaceId = getActiveWorkspaceId() ?? ensureWorkspaceExists().id
      const fallbackWorkspace =
        loadPersistedWorkspace(fallbackWorkspaceId) ?? ensureWorkspaceExists()
      setRoute(
        readRoute(window.location.search, {
          fallbackWorkspaceId: fallbackWorkspace.id,
          fallbackSurface: 'desktop',
        }),
      )
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const workspaceOptions = (() => {
    const listed = listPersistedWorkspaces()
    return listed.length > 0
      ? listed.map((workspace) => ({ id: workspace.id, name: workspace.name }))
      : [{ id: ensuredWorkspace.id, name: ensuredWorkspace.name }]
  })()

  const activeWorkspaceId = useMemo(() => {
    if (route.workspaceId && workspaceOptions.some((workspace) => workspace.id === route.workspaceId)) {
      return route.workspaceId
    }
    return getActiveWorkspaceId() ?? workspaceOptions[0]?.id ?? ensuredWorkspace.id
  }, [ensuredWorkspace.id, route.workspaceId, workspaceOptions])

  const activeWorkspace = loadPersistedWorkspace(activeWorkspaceId) ?? ensuredWorkspace
  const normalizedRoute = useMemo(
    () =>
      normalizeRoute(route, {
        fallbackWorkspaceId: activeWorkspace.id,
        fallbackSurface: 'desktop',
      }),
    [activeWorkspace.id, route],
  )
  const focusedProblemId = normalizedRoute.problemId ?? activeWorkspace.focusedProblemId ?? null
  const worldProjectionId = normalizedRoute.projectionId ?? activeWorkspace.lastProjection ?? 'room'

  const commitRoute = useCallback(
    (nextRoute: AppRoute | ((current: AppRoute) => AppRoute)) => {
      setRoute((current) => {
        const resolved =
          typeof nextRoute === 'function' ? nextRoute(current) : nextRoute
        const normalized = normalizeRoute(resolved, {
          fallbackWorkspaceId: activeWorkspace.id,
          fallbackSurface: 'desktop',
        })
        writeRoute(normalized)
        return normalized
      })
    },
    [activeWorkspace.id],
  )

  useEffect(() => {
    setActiveWorkspaceId(activeWorkspace.id)
    if (activeWorkspace.lastSurface !== normalizedRoute.surface) {
      updatePersistedWorkspaceSurface(activeWorkspace.id, normalizedRoute.surface)
    }
    if (normalizedRoute.projectionId && activeWorkspace.lastProjection !== normalizedRoute.projectionId) {
      updatePersistedWorkspaceProjection(activeWorkspace.id, normalizedRoute.projectionId)
    }
    writeRoute({
      ...normalizedRoute,
      projectionId: worldProjectionId,
    })
  }, [activeWorkspace.id, activeWorkspace.lastProjection, activeWorkspace.lastSurface, normalizedRoute, worldProjectionId])

  useEffect(() => {
    if (normalizedRoute.surface !== 'phone') return

    let cancelled = false
    const settings = loadButlerBridgeSettings()

    void getButlerBridgeHealth(settings)
      .then((health) => {
        if (!cancelled) setPhoneBridgeHealth(health)
      })
      .catch(() => {
        if (!cancelled) setPhoneBridgeHealth(null)
      })

    void listSwarmRuns(settings, { limit: 12 })
      .then((runs) => {
        if (!cancelled) setPhoneRuns(runs)
      })
      .catch(() => {
        if (!cancelled) setPhoneRuns([])
      })

    return () => {
      cancelled = true
    }
  }, [activeWorkspace.id, activeWorkspace.updatedAt, normalizedRoute.surface, storeVersion])

  const selectWorkspace = useCallback(
    (workspaceId: string) => {
      const nextWorkspace = loadPersistedWorkspace(workspaceId)
      if (!nextWorkspace) return
      setActiveWorkspaceId(workspaceId)
      commitRoute((current) => ({
        ...current,
        workspaceId,
        problemId: nextWorkspace.focusedProblemId ?? null,
        focusRef: nextWorkspace.focusedProblemId ? worldRef('room', nextWorkspace.focusedProblemId) : null,
      }))
    },
    [commitRoute],
  )

  const createWorkspaceAction = useCallback(() => {
    const created = createPersistedWorkspace('Primary workspace', buildSeedBoard())
    commitRoute((current) => ({
      ...current,
      workspaceId: created.id,
      problemId: null,
      focusRef: null,
    }))
  }, [commitRoute])

  const duplicateWorkspaceAction = useCallback(() => {
    const duplicated = duplicatePersistedWorkspace(activeWorkspace.id)
    if (!duplicated) return
    commitRoute((current) => ({
      ...current,
      workspaceId: duplicated.id,
      problemId: duplicated.focusedProblemId ?? null,
      focusRef: duplicated.focusedProblemId ? worldRef('room', duplicated.focusedProblemId) : null,
    }))
  }, [activeWorkspace.id, commitRoute])

  const renameWorkspaceAction = useCallback(
    (name: string) => {
      renamePersistedWorkspace(activeWorkspace.id, name)
      setStoreVersion((value) => value + 1)
    },
    [activeWorkspace.id],
  )

  const deleteWorkspaceAction = useCallback(() => {
    const next = deletePersistedWorkspace(activeWorkspace.id)
    const nextWorkspace =
      (next.activeWorkspaceId ? loadPersistedWorkspace(next.activeWorkspaceId) : null) ??
      createPersistedWorkspace('Primary workspace', buildSeedBoard())
    commitRoute((current) => ({
      ...current,
      workspaceId: nextWorkspace.id,
      problemId: nextWorkspace.focusedProblemId ?? null,
      focusRef: nextWorkspace.focusedProblemId ? worldRef('room', nextWorkspace.focusedProblemId) : null,
    }))
  }, [activeWorkspace.id, commitRoute])

  const focusProblemAction = useCallback(
    (problemId: string | null) => {
      if ((activeWorkspace.focusedProblemId ?? null) !== problemId) {
        updatePersistedWorkspaceFocus(activeWorkspace.id, problemId ?? undefined)
      }
      commitRoute((current) => ({
        ...current,
        problemId,
        focusRef: problemId ? worldRef('room', problemId) : null,
      }))
    },
    [activeWorkspace.focusedProblemId, activeWorkspace.id, commitRoute],
  )

  const openPhoneRelayAction = useCallback(
    (problemId: string | null) => {
      if (problemId && activeWorkspace.focusedProblemId !== problemId) {
        updatePersistedWorkspaceFocus(activeWorkspace.id, problemId)
      }
      commitRoute({
        surface: 'phone',
        workspaceId: activeWorkspace.id,
        problemId: problemId ?? focusedProblemId,
        projectionId: normalizedRoute.projectionId,
        focusRef: normalizedRoute.focusRef,
      })
    },
    [activeWorkspace.focusedProblemId, activeWorkspace.id, commitRoute, focusedProblemId, normalizedRoute.focusRef, normalizedRoute.projectionId],
  )

  const openWorldAction = useCallback(
    (problemId: string | null) => {
      if (problemId && activeWorkspace.focusedProblemId !== problemId) {
        updatePersistedWorkspaceFocus(activeWorkspace.id, problemId)
      }
      commitRoute({
        surface: 'world',
        workspaceId: activeWorkspace.id,
        problemId: problemId ?? focusedProblemId,
        projectionId: normalizedRoute.projectionId,
        focusRef: normalizedRoute.focusRef,
      })
    },
    [activeWorkspace.focusedProblemId, activeWorkspace.id, commitRoute, focusedProblemId, normalizedRoute.focusRef, normalizedRoute.projectionId],
  )

  const openDesktopAction = useCallback((problemId?: string | null) => {
    if (problemId && activeWorkspace.focusedProblemId !== problemId) {
      updatePersistedWorkspaceFocus(activeWorkspace.id, problemId)
    }
    commitRoute({
      surface: 'desktop',
      workspaceId: activeWorkspace.id,
      problemId: problemId ?? focusedProblemId,
      projectionId: normalizedRoute.projectionId,
      focusRef: normalizedRoute.focusRef,
    })
  }, [activeWorkspace.focusedProblemId, activeWorkspace.id, commitRoute, focusedProblemId, normalizedRoute.focusRef, normalizedRoute.projectionId])

  const phoneShellData = useMemo(
    () =>
      buildPhoneRelayShellData({
        workspaceId: activeWorkspace.id,
        workspaceName: activeWorkspace.name,
        workspaceSubtitle:
          'Synced relay view for phone-first capture, triage, and handoff back to desktop.',
        workspaceMode: 'phone',
        bridgeHealth: phoneBridgeHealth,
        cards: activeWorkspace.board.cards,
        selectedProblemId: focusedProblemId,
        runs: phoneRuns,
      }),
    [activeWorkspace, focusedProblemId, phoneBridgeHealth, phoneRuns],
  )

  const workspaceWorldGraph = useMemo(
    () =>
      buildWorkspaceWorldGraph(
        activeWorkspace.name,
        activeWorkspace.board.cards,
        activeWorkspace.board.wires,
      ),
    [activeWorkspace.board.cards, activeWorkspace.board.wires, activeWorkspace.name],
  )
  const workspaceWorldIndex = useMemo(
    () => buildWorldIndex(workspaceWorldGraph),
    [workspaceWorldGraph],
  )

  const resolveRoomIdForWorldFocus = useCallback(
    (focusRef: WorldRef | null): string | null => {
      if (!focusRef) return focusedProblemId
      switch (focusRef.kind) {
        case 'room':
          return focusRef.id
        case 'locus':
          return workspaceWorldIndex.locusById.get(focusRef.id)?.roomId ?? focusedProblemId
        case 'artifact':
          return workspaceWorldIndex.artifactById.get(focusRef.id)?.roomId ?? focusedProblemId
        case 'person':
        case 'animal':
        case 'plant':
        case 'organization':
        case 'agent':
          return workspaceWorldIndex.actorById.get(focusRef.id)?.roomIds[0] ?? focusedProblemId
        case 'wing':
          return workspaceWorldIndex.roomsByWingId.get(focusRef.id)?.[0]?.id ?? focusedProblemId
        default:
          return focusedProblemId
      }
    },
    [focusedProblemId, workspaceWorldIndex],
  )

  const setWorldFocusAction = useCallback(
    (focusRef: WorldRef | null) => {
      const roomId = resolveRoomIdForWorldFocus(focusRef)
      if ((activeWorkspace.focusedProblemId ?? null) !== roomId) {
        updatePersistedWorkspaceFocus(activeWorkspace.id, roomId ?? undefined)
      }
      commitRoute((current) => ({
        ...current,
        problemId: roomId,
        focusRef,
      }))
    },
    [activeWorkspace.focusedProblemId, activeWorkspace.id, commitRoute, resolveRoomIdForWorldFocus],
  )

  const worldShellData = useMemo(
    () =>
      buildWorldShellData(workspaceWorldGraph, {
        workspaceName: activeWorkspace.name,
        cards: activeWorkspace.board.cards,
        focusedProblemId,
        selectedProjectionId: worldProjectionId,
        selectedFocusRef: normalizedRoute.focusRef,
      }),
    [activeWorkspace.board.cards, activeWorkspace.name, focusedProblemId, normalizedRoute.focusRef, workspaceWorldGraph, worldProjectionId],
  )

  return (
    <ErrorBoundary>
      {normalizedRoute.surface === 'phone' ? (
        <PhoneRelayShell
          {...phoneShellData}
          onFocusProblem={(problemId) => {
            focusProblemAction(problemId)
          }}
          onJumpToDesktop={() => openDesktopAction()}
        />
      ) : normalizedRoute.surface === 'world' ? (
        <WorldShell
          {...worldShellData}
          selectedProjectionId={worldProjectionId}
          onProjectionSelect={(projectionId) => {
            const nextProjectionId = normalizeProjection(projectionId)
            if (nextProjectionId) {
              updatePersistedWorkspaceProjection(activeWorkspace.id, nextProjectionId)
            }
            commitRoute((current) => ({
              ...current,
              projectionId: nextProjectionId ?? current.projectionId,
            }))
          }}
          onRoomSelect={(roomId) => {
            setWorldFocusAction(worldRef('room', roomId))
          }}
          onDrillStageSelect={(stageId) => {
            if (stageId === 'earth') {
              setWorldFocusAction(null)
              return
            }
            if (stageId === 'wing') {
              const roomId = worldShellData.selectedRoomId ?? focusedProblemId
              const wingId =
                (roomId ? workspaceWorldIndex.roomById.get(roomId)?.wingId : null) ??
                workspaceWorldGraph.entryWingId ??
                workspaceWorldGraph.wings[0]?.id
              if (wingId) {
                setWorldFocusAction(worldRef('wing', wingId))
              }
              return
            }
            if (stageId === 'room') {
              const roomId = worldShellData.selectedRoomId ?? focusedProblemId
              if (roomId) {
                setWorldFocusAction(worldRef('room', roomId))
              }
              return
            }
            if (stageId === 'locus' && worldShellData.selectedLocusId) {
              setWorldFocusAction(worldRef('locus', worldShellData.selectedLocusId))
            }
          }}
          onLocusSelect={(locusId) => {
            setWorldFocusAction(worldRef('locus', locusId))
          }}
          onFocusRefSelect={(focusRef) => {
            setWorldFocusAction(focusRef)
          }}
          onOpenDesktop={(roomId) => {
            openDesktopAction(roomId)
          }}
          onOpenPhoneRelay={(roomId) => {
            openPhoneRelayAction(roomId)
          }}
        />
      ) : (
        <BoardView
          bootId={activeWorkspace.id}
          bootState={{
            camera: activeWorkspace.board.camera,
            cards: activeWorkspace.board.cards,
            wires: activeWorkspace.board.wires,
          }}
          syncToken={storeVersion}
          workspaceId={activeWorkspace.id}
          workspaceName={activeWorkspace.name}
          workspaceOptions={workspaceOptions}
          focusedProblemId={focusedProblemId}
          onFocusedProblemChange={focusProblemAction}
          onWorkspaceChange={selectWorkspace}
          onCreateWorkspace={createWorkspaceAction}
          onDuplicateWorkspace={duplicateWorkspaceAction}
          onRenameWorkspace={renameWorkspaceAction}
          onDeleteWorkspace={deleteWorkspaceAction}
          onOpenPhoneRelay={openPhoneRelayAction}
          onOpenWorldShell={openWorldAction}
        />
      )}
    </ErrorBoundary>
  )
}
