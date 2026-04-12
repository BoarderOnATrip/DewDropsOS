import { describe, expect, it } from 'vitest'
import { parseBoardJsonString, parsePersistedBoardJson, stringifyBoard } from './persistBoard'

describe('parsePersistedBoardJson', () => {
  it('accepts a minimal valid v1 payload', () => {
    const raw = {
      v: 1,
      camera: { x: 1, y: -2, zoom: 0.9 },
      cards: [
        {
          id: 'a1',
          x: 0,
          y: 0,
          width: 100,
          height: 80,
          title: 'Test',
          expanded: true,
          color: '#fff',
          kind: 'agent' as const,
          assignedToProblemId: null,
        },
      ],
      wires: [],
    }
    const p = parsePersistedBoardJson(raw)
    expect(p).not.toBeNull()
    expect(p!.camera.zoom).toBe(0.9)
    expect(p!.cards[0].title).toBe('Test')
    expect(p!.wires).toEqual([])
  })

  it('rejects wrong version', () => {
    expect(parsePersistedBoardJson({ v: 2, camera: { x: 0, y: 0, zoom: 1 }, cards: [], wires: [] })).toBeNull()
  })

  it('rejects garbage', () => {
    expect(parsePersistedBoardJson(null)).toBeNull()
    expect(parsePersistedBoardJson({})).toBeNull()
    expect(parsePersistedBoardJson({ v: 1, camera: 'nope', cards: [], wires: [] })).toBeNull()
  })

  it('round-trips through stringifyBoard and parseBoardJsonString', () => {
    const camera = { x: 12, y: -3, zoom: 0.85 }
    const cards = [
      {
        id: 'p1',
        x: 0,
        y: 0,
        width: 200,
        height: 120,
        title: 'Problem',
        expanded: true,
        color: '#34c759',
        kind: 'problem' as const,
        problemShape: 'panel' as const,
      },
    ]
    const wires = [{ id: 'w1', fromCardId: 'p1', toCardId: 'a1' }]
    const s = stringifyBoard(camera, cards, wires)
    const back = parseBoardJsonString(s)
    expect(back).not.toBeNull()
    expect(back!.camera).toEqual(camera)
    expect(back!.cards[0].title).toBe('Problem')
    expect(back!.wires).toHaveLength(1)
  })

  it('parseBoardJsonString rejects invalid JSON text', () => {
    expect(parseBoardJsonString('')).toBeNull()
    expect(parseBoardJsonString('{')).toBeNull()
    expect(parseBoardJsonString('{"v":1}')).toBeNull()
  })
})
