import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addPaperclipIssueComment,
  createPaperclipIssue,
  getPaperclipIssueDocument,
  invokePaperclipAgent,
  listPaperclipAgents,
  listPaperclipCompanies,
  listPaperclipProjects,
  loadPaperclipBridgeSettings,
  savePaperclipBridgeSettings,
  upsertPaperclipIssueDocument,
  type PaperclipBridgeSettings,
} from './paperclipBridge'

function createMemoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear() {
      data.clear()
    },
    getItem(key: string) {
      return data.get(key) ?? null
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null
    },
    removeItem(key: string) {
      data.delete(key)
    },
    setItem(key: string, value: string) {
      data.set(key, value)
    },
  } as Storage
}

function jsonResponse(payload: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(payload), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const settings: PaperclipBridgeSettings = {
  url: 'http://127.0.0.1:3100/',
  token: 'secret-token',
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createMemoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('paperclipBridge settings', () => {
  it('normalizes and persists settings', () => {
    const saved = savePaperclipBridgeSettings(settings)
    expect(saved.url).toBe('http://127.0.0.1:3100')
    expect(loadPaperclipBridgeSettings()).toEqual({
      url: 'http://127.0.0.1:3100',
      token: 'secret-token',
    })
  })
})

describe('paperclipBridge requests', () => {
  it('lists companies, projects, and agents', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 'company-1', name: 'aiButler' }]))
      .mockResolvedValueOnce(jsonResponse([{ id: 'project-1', name: 'DewDrops' }]))
      .mockResolvedValueOnce(jsonResponse([{ id: 'agent-1', name: 'Codex CTO', adapterType: 'codex_local' }]))
    vi.stubGlobal('fetch', fetchMock)

    await expect(listPaperclipCompanies(settings)).resolves.toEqual([
      expect.objectContaining({ id: 'company-1', name: 'aiButler' }),
    ])
    await expect(listPaperclipProjects(settings, 'company-1')).resolves.toEqual([
      expect.objectContaining({ id: 'project-1', name: 'DewDrops' }),
    ])
    await expect(listPaperclipAgents(settings, 'company-1')).resolves.toEqual([
      expect.objectContaining({ id: 'agent-1', name: 'Codex CTO', adapterType: 'codex_local' }),
    ])

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:3100/api/companies',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:3100/api/companies/company-1/projects',
      expect.any(Object),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:3100/api/companies/company-1/agents',
      expect.any(Object),
    )
  })

  it('creates an issue, comments, updates the plan document, and invokes an agent', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'issue-1', title: 'Ship DewDrops' }, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 201 }))
      .mockResolvedValueOnce(new Response('{"error":"Issue document not found"}', { status: 404 }))
      .mockResolvedValueOnce(new Response('{"error":"Issue document not found"}', { status: 404 }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'doc-1',
          key: 'plan',
          body: '# Plan',
          latestRevisionId: 'rev-1',
        }, { status: 201 }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: 'run-42' }, { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createPaperclipIssue(settings, {
        companyId: 'company-1',
        title: 'Ship DewDrops',
        description: 'Launch the room.',
        assigneeAgentId: 'agent-1',
        projectId: 'project-1',
      }),
    ).resolves.toEqual(expect.objectContaining({
      id: 'issue-1',
      title: 'Ship DewDrops',
    }))

    await addPaperclipIssueComment(settings, 'issue-1', '@Codex CTO Start here.')

    await expect(
      getPaperclipIssueDocument(settings, 'issue-1', 'plan'),
    ).resolves.toBeNull()

    await expect(
      upsertPaperclipIssueDocument(settings, 'issue-1', {
        key: 'plan',
        title: 'DewDrops launch packet',
        body: '# Plan',
      }),
    ).resolves.toEqual(expect.objectContaining({
      id: 'doc-1',
      key: 'plan',
      body: '# Plan',
      latestRevisionId: 'rev-1',
    }))

    await expect(invokePaperclipAgent(settings, 'agent-1')).resolves.toEqual({ runId: 'run-42' })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:3100/api/companies/company-1/issues',
      expect.objectContaining({
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'http://127.0.0.1:3100/api/issues/issue-1/documents/plan',
      expect.objectContaining({
        method: 'PUT',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      'http://127.0.0.1:3100/api/agents/agent-1/heartbeat/invoke',
      expect.objectContaining({
        method: 'POST',
      }),
    )
  })
})
