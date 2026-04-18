import { describe, expect, it } from 'vitest'
import {
  buildRouteSearch,
  normalizeFocusKind,
  normalizeFocusRef,
  normalizeProjection,
  normalizeRoute,
  normalizeSurface,
  readRoute,
} from './appRoute'

describe('appRoute helpers', () => {
  it('defaults to the fallback surface when none is provided', () => {
    expect(normalizeSurface(undefined)).toBe('desktop')
    expect(normalizeSurface(undefined, 'world')).toBe('world')
    expect(
      normalizeRoute({}, { fallbackWorkspaceId: 'workspace-1', fallbackSurface: 'desktop' }),
    ).toEqual({
      surface: 'desktop',
      workspaceId: 'workspace-1',
      problemId: null,
      projectionId: null,
      focusRef: null,
    })
  })

  it('reads world, desktop, and phone surfaces from query params', () => {
    expect(readRoute('?surface=world&workspace=a', { fallbackWorkspaceId: 'x' }).surface).toBe(
      'world',
    )
    expect(readRoute('?surface=desktop&workspace=a', { fallbackWorkspaceId: 'x' }).surface).toBe(
      'desktop',
    )
    expect(readRoute('?surface=phone&workspace=a', { fallbackWorkspaceId: 'x' }).surface).toBe(
      'phone',
    )
  })

  it('normalizes and reads projection ids from query params', () => {
    expect(normalizeProjection('fold')).toBe('fold')
    expect(normalizeProjection('invalid')).toBeNull()
    expect(
      readRoute('?workspace=a&projection=packet', { fallbackWorkspaceId: 'x' }).projectionId,
    ).toBe('packet')
  })

  it('normalizes and reads focus refs from query params', () => {
    expect(normalizeFocusKind('locus')).toBe('locus')
    expect(normalizeFocusKind('galaxy')).toBeNull()
    expect(normalizeFocusRef({ kind: 'room', id: 'room-1' })).toEqual({
      kind: 'room',
      id: 'room-1',
    })
    expect(normalizeFocusRef(null, 'locus', 'room-1-locus')).toEqual({
      kind: 'locus',
      id: 'room-1-locus',
    })
    expect(
      readRoute('?workspace=a&focusKind=locus&focusId=room-1-locus', { fallbackWorkspaceId: 'x' }).focusRef,
    ).toEqual({
      kind: 'locus',
      id: 'room-1-locus',
    })
  })

  it('omits the desktop surface from serialized URLs and keeps world/phone explicit', () => {
    expect(
      buildRouteSearch({
        surface: 'desktop',
        workspaceId: 'alpha',
        problemId: 'room-1',
        projectionId: 'room',
        focusRef: null,
      }),
    ).toBe('workspace=alpha&problem=room-1')

    expect(
      buildRouteSearch({
        surface: 'world',
        workspaceId: 'alpha',
        problemId: 'room-1',
        projectionId: 'fold',
        focusRef: null,
      }),
    ).toBe('surface=world&workspace=alpha&problem=room-1&projection=fold')

    expect(
      buildRouteSearch({
        surface: 'phone',
        workspaceId: 'alpha',
        problemId: 'room-1',
        projectionId: 'packet',
        focusRef: {
          kind: 'locus',
          id: 'room-1-locus',
        },
      }),
    ).toBe(
      'surface=phone&workspace=alpha&problem=room-1&projection=packet&focusKind=locus&focusId=room-1-locus',
    )
  })
})
