import type { ProjectionMode, WorldNodeKind, WorldRef } from './world/model'

export type AppSurface = 'world' | 'desktop' | 'phone'

export type AppRoute = {
  surface: AppSurface
  workspaceId: string | null
  problemId: string | null
  projectionId: ProjectionMode | null
  focusRef: WorldRef | null
}

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
