import type { ProjectionMode, WorldNodeKind, WorldRef } from './world/model'

export type AppSurface = 'world' | 'desktop' | 'phone'

export type AppRoute = {
  surface: AppSurface
  workspaceId: string | null
  problemId: string | null
  projectionId: ProjectionMode | null
  focusRef: WorldRef | null
}

export type RouteWriteMode = 'push' | 'replace'

type RouteOptions = {
  fallbackWorkspaceId: string
  fallbackSurface?: AppSurface
}

type LooseAppRoute = Omit<Partial<AppRoute>, 'surface' | 'projectionId'> & {
  surface?: string | null
  projectionId?: string | null
  focusRef?: WorldRef | null
  focusKind?: string | null
  focusId?: string | null
}

export function normalizeFocusKind(
  focusKind: string | null | undefined,
): WorldNodeKind | null {
  if (
    focusKind === 'wing' ||
    focusKind === 'person' ||
    focusKind === 'animal' ||
    focusKind === 'plant' ||
    focusKind === 'organization' ||
    focusKind === 'agent' ||
    focusKind === 'room' ||
    focusKind === 'locus' ||
    focusKind === 'artifact'
  ) {
    return focusKind
  }
  return null
}

export function normalizeFocusRef(
  focusRef: WorldRef | null | undefined,
  focusKind?: string | null,
  focusId?: string | null,
): WorldRef | null {
  if (focusRef) {
    const normalizedKind = normalizeFocusKind(focusRef.kind)
    if (normalizedKind && focusRef.id?.trim()) {
      return {
        kind: normalizedKind,
        id: focusRef.id.trim(),
      }
    }
  }

  const normalizedKind = normalizeFocusKind(focusKind)
  const normalizedId = focusId?.trim()
  if (!normalizedKind || !normalizedId) return null
  return {
    kind: normalizedKind,
    id: normalizedId,
  }
}

export function normalizeProjection(
  projectionId: string | null | undefined,
): ProjectionMode | null {
  if (
    projectionId === 'earth' ||
    projectionId === 'wing' ||
    projectionId === 'room' ||
    projectionId === 'fold' ||
    projectionId === 'outline' ||
    projectionId === 'packet'
  ) {
    return projectionId
  }
  return null
}

export function normalizeSurface(
  surface: string | null | undefined,
  fallbackSurface: AppSurface = 'desktop',
): AppSurface {
  if (surface === 'world' || surface === 'desktop' || surface === 'phone') {
    return surface
  }
  return fallbackSurface
}

export function normalizeRoute(
  route: LooseAppRoute,
  { fallbackWorkspaceId, fallbackSurface = 'desktop' }: RouteOptions,
): AppRoute {
  return {
    surface: normalizeSurface(route.surface, fallbackSurface),
    workspaceId: route.workspaceId?.trim() || fallbackWorkspaceId,
    problemId: route.problemId?.trim() || null,
    projectionId: normalizeProjection(route.projectionId ?? null),
    focusRef: normalizeFocusRef(route.focusRef, route.focusKind, route.focusId),
  }
}

export function buildSurfaceRoute(
  route: AppRoute,
  overrides: {
    surface: AppSurface
    workspaceId: string
    problemId?: string | null
    projectionId?: ProjectionMode | null
  },
): AppRoute {
  const nextProblemId = overrides.problemId ?? route.problemId
  const nextProjectionId = overrides.projectionId ?? route.projectionId
  return normalizeRoute(
    {
      surface: overrides.surface,
      workspaceId: overrides.workspaceId,
      problemId: nextProblemId,
      projectionId: nextProjectionId,
      focusRef: overrides.problemId ? { kind: 'room', id: overrides.problemId } : null,
    },
    {
      fallbackWorkspaceId: overrides.workspaceId,
      fallbackSurface: overrides.surface,
    },
  )
}

export function readRoute(
  search: string,
  options: RouteOptions,
): AppRoute {
  const params = new URLSearchParams(search)
  return normalizeRoute(
    {
      surface: params.get('surface') ?? undefined,
      workspaceId: params.get('workspace'),
      problemId: params.get('problem'),
      projectionId: params.get('projection'),
      focusKind: params.get('focusKind'),
      focusId: params.get('focusId'),
    },
    options,
  )
}

export function buildRouteSearch(route: AppRoute): string {
  const params = new URLSearchParams()
  if (route.surface !== 'desktop') {
    params.set('surface', route.surface)
  }
  if (route.workspaceId) {
    params.set('workspace', route.workspaceId)
  }
  if (route.problemId) {
    params.set('problem', route.problemId)
  }
  if (route.projectionId && route.projectionId !== 'room') {
    params.set('projection', route.projectionId)
  }
  if (route.focusRef) {
    params.set('focusKind', route.focusRef.kind)
    params.set('focusId', route.focusRef.id)
  }
  return params.toString()
}

export function applyRouteToBrowser(route: AppRoute, mode: RouteWriteMode = 'replace'): void {
  if (typeof window === 'undefined') return

  const nextSearch = buildRouteSearch(route)
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
  const state = {
    surface: route.surface,
    workspaceId: route.workspaceId,
    problemId: route.problemId,
    projectionId: route.projectionId,
    focusKind: route.focusRef?.kind ?? null,
    focusId: route.focusRef?.id ?? null,
  }
  if (mode === 'push') {
    window.history.pushState(state, '', nextUrl)
    return
  }
  window.history.replaceState(state, '', nextUrl)
}
