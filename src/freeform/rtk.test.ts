import { describe, expect, it } from 'vitest'
import {
  buildRtkBasis,
  buildRtkDelta,
  formatHandoffNotes,
  parseHandoffNotes,
  serializeRtkBasisLines,
  serializeRtkDeltaLines,
  type RtkBasis,
} from './rtk'

function minimalBasis(): Parameters<typeof buildRtkBasis>[0] {
  return {
    room_id: 'room-1',
    target: 'Test target',
    launcher: 'desktop',
    workspace_mode: 'desktop',
    launch_surface: 'desktop',
    memory_wing: 'test-wing',
    memory_room: 'test-room',
    context_summary: 'Context for the test room.',
    anchors: [],
  }
}

describe('buildRtkBasis', () => {
  it('builds a minimal basis with required fields only', () => {
    const basis = buildRtkBasis(minimalBasis())
    expect(basis.v).toBe(1)
    expect(basis.room_id).toBe('room-1')
    expect(basis.target).toBe('Test target')
    expect(basis.launcher).toBe('desktop')
    expect(basis.workspace_mode).toBe('desktop')
    expect(basis.launch_surface).toBe('desktop')
    expect(basis.memory_wing).toBe('test-wing')
    expect(basis.memory_room).toBe('test-room')
    expect(basis.context_summary).toBe('Context for the test room.')
    expect(basis.anchors).toEqual([])
  })

  it('collapses internal whitespace in string fields', () => {
    const basis = buildRtkBasis({
      ...minimalBasis(),
      room_id: '  room   1  ',
      target: 'Ship  the   feature',
      context_summary: 'Build  a  contact   list.',
    })
    expect(basis.room_id).toBe('room 1')
    expect(basis.target).toBe('Ship the feature')
    expect(basis.context_summary).toBe('Build a contact list.')
  })

  it('omits optional fields that are empty strings', () => {
    const basis = buildRtkBasis({
      ...minimalBasis(),
      brief_hash: '',
      mission: '   ',
      beneficiary: '',
      capability_profile_id: '  ',
      swarm_recipe_id: '',
    })
    expect(basis.brief_hash).toBeUndefined()
    expect(basis.mission).toBeUndefined()
    expect(basis.beneficiary).toBeUndefined()
    expect(basis.capability_profile_id).toBeUndefined()
    expect(basis.swarm_recipe_id).toBeUndefined()
  })

  it('includes optional scalar fields when present', () => {
    const basis = buildRtkBasis({
      ...minimalBasis(),
      brief_version: 3,
      brief_hash: 'abc123',
      capability_profile_id: 'build-local',
      swarm_recipe_id: 'build-review-ship',
      mission: 'Ship the contact list.',
      beneficiary: 'Stephanie',
      task: 'Build a contact list with search.',
      milestone: 'CRM foundation',
      escalation_policy: 'outcome-contradiction-only',
      autonomy_policy: 'full-auto',
      phone_brief: 'Capture changes from the field.',
      desktop_brief: 'Implement the listing workflow.',
    })
    expect(basis.brief_version).toBe(3)
    expect(basis.brief_hash).toBe('abc123')
    expect(basis.capability_profile_id).toBe('build-local')
    expect(basis.swarm_recipe_id).toBe('build-review-ship')
    expect(basis.mission).toBe('Ship the contact list.')
    expect(basis.beneficiary).toBe('Stephanie')
    expect(basis.task).toBe('Build a contact list with search.')
    expect(basis.milestone).toBe('CRM foundation')
    expect(basis.escalation_policy).toBe('outcome-contradiction-only')
    expect(basis.autonomy_policy).toBe('full-auto')
    expect(basis.phone_brief).toBe('Capture changes from the field.')
    expect(basis.desktop_brief).toBe('Implement the listing workflow.')
  })

  it('cleans list fields and filters empty entries', () => {
    const basis = buildRtkBasis({
      ...minimalBasis(),
      anchors: ['wing/crm', '  ', 'room/contacts'],
      acceptance_criteria: ['ac-1:Search returns results.', '', '  ac-2:Notes editable.  '],
      scope_in: ['Search', 'Notes'],
      scope_out: ['Email integration'],
      project_structure: ['src/', 'src/app/', 'src/app/contact/page.tsx'],
      deliverables: ['Contact list screen'],
      depends_on: ['room-upstream'],
      blocked_by: [],
    })
    expect(basis.anchors).toEqual(['wing/crm', 'room/contacts'])
    expect(basis.acceptance_criteria).toEqual(['ac-1:Search returns results.', 'ac-2:Notes editable.'])
    expect(basis.scope_in).toEqual(['Search', 'Notes'])
    expect(basis.scope_out).toEqual(['Email integration'])
    expect(basis.project_structure).toEqual(['src/', 'src/app/', 'src/app/contact/page.tsx'])
    expect(basis.deliverables).toEqual(['Contact list screen'])
    expect(basis.depends_on).toEqual(['room-upstream'])
    expect(basis.blocked_by).toEqual([])
  })

  it('cleans and preserves visual loci', () => {
    const basis = buildRtkBasis({
      ...minimalBasis(),
      visual_loci: [
        { id: 'north-star', title: '  North Star  ', kind: 'north_star', detail: 'Keep the goal visible.' },
        { id: 'contact-db', title: 'Contact DB', kind: 'artifact', detail: '  Schema store.  ' },
      ],
    })
    expect(basis.visual_loci).toHaveLength(2)
    expect(basis.visual_loci?.[0]?.title).toBe('North Star')
    expect(basis.visual_loci?.[0]?.kind).toBe('north_star')
    expect(basis.visual_loci?.[1]?.detail).toBe('Schema store.')
  })
})

describe('serializeRtkBasisLines', () => {
  it('emits rtk:v1 as the first line', () => {
    const lines = serializeRtkBasisLines(buildRtkBasis(minimalBasis()))
    expect(lines[0]).toBe('rtk:v1')
  })

  it('includes all required scalar fields as key:value lines', () => {
    const lines = serializeRtkBasisLines(buildRtkBasis(minimalBasis()))
    expect(lines).toContain('rid:room-1')
    expect(lines).toContain('ws:desktop')
    expect(lines).toContain('ls:desktop')
    expect(lines).toContain('tg:Test target')
    expect(lines).toContain('ln:desktop')
    expect(lines).toContain('mw:test-wing')
    expect(lines).toContain('mr:test-room')
    expect(lines).toContain('ctx:Context for the test room.')
  })

  it('omits lines for undefined and empty-string optional fields', () => {
    const lines = serializeRtkBasisLines(buildRtkBasis(minimalBasis()))
    const keys = lines.map((line) => line.split(':')[0])
    expect(keys).not.toContain('bv')
    expect(keys).not.toContain('bh')
    expect(keys).not.toContain('cp')
    expect(keys).not.toContain('sr')
    expect(keys).not.toContain('m')
    expect(keys).not.toContain('ac')
  })

  it('includes optional scalar fields when present', () => {
    const basis = buildRtkBasis({
      ...minimalBasis(),
      brief_version: 3,
      brief_hash: 'abc123',
      capability_profile_id: 'build-local',
      task: 'Build a contact list.',
      milestone: 'CRM foundation',
    })
    const lines = serializeRtkBasisLines(basis)
    expect(lines).toContain('bv:3')
    expect(lines).toContain('bh:abc123')
    expect(lines).toContain('cp:build-local')
    expect(lines).toContain('tk:Build a contact list.')
    expect(lines).toContain('mil:CRM foundation')
  })

  it('serializes lists with pipe-delimited joins', () => {
    const basis = buildRtkBasis({
      ...minimalBasis(),
      acceptance_criteria: ['ac-1:Fast search.', 'ac-2:Notes editable.'],
      scope_in: ['Search', 'Notes'],
      scope_out: ['Email'],
      project_structure: ['src/', 'src/app/', 'src/app/contact/page.tsx'],
      anchors: ['wing/crm', 'room/contacts'],
    })
    const lines = serializeRtkBasisLines(basis)
    expect(lines).toContain('ac:ac-1:Fast search. | ac-2:Notes editable.')
    expect(lines).toContain('in:Search | Notes')
    expect(lines).toContain('out:Email')
    expect(lines).toContain('ps:src/ | src/app/ | src/app/contact/page.tsx')
    expect(lines).toContain('a:wing/crm | room/contacts')
  })

  it('serializes visual loci as numbered l1:, l2: lines', () => {
    const basis = buildRtkBasis({
      ...minimalBasis(),
      visual_loci: [
        { id: 'ns', title: 'North Star', kind: 'north_star', detail: 'Keep the goal visible.' },
        { id: 'db', title: 'Contact DB', kind: 'artifact', detail: 'Schema store.' },
      ],
    })
    const lines = serializeRtkBasisLines(basis)
    expect(lines).toContain('l1:north_star | North Star | Keep the goal visible.')
    expect(lines).toContain('l2:artifact | Contact DB | Schema store.')
  })

  it('emits no locus lines when visual_loci is empty', () => {
    const lines = serializeRtkBasisLines(buildRtkBasis(minimalBasis()))
    expect(lines.some((line) => /^l\d+:/.test(line))).toBe(false)
  })

  it('round-trips: serialized lines reconstruct field values', () => {
    const basis: RtkBasis = buildRtkBasis({
      ...minimalBasis(),
      brief_version: 2,
      brief_hash: 'hash-xyz',
      mission: 'Ship the CRM.',
      task: 'Build contacts module.',
      acceptance_criteria: ['ac-1:Contacts searchable.'],
      escalation_policy: 'outcome-contradiction-only',
      autonomy_policy: 'full-auto',
    })
    const lines = serializeRtkBasisLines(basis)
    const lineMap = new Map(lines.map((line) => [line.split(':')[0], line]))
    expect(lineMap.get('bv')).toBe('bv:2')
    expect(lineMap.get('bh')).toBe('bh:hash-xyz')
    expect(lineMap.get('m')).toBe('m:Ship the CRM.')
    expect(lineMap.get('tk')).toBe('tk:Build contacts module.')
    expect(lineMap.get('ac')).toBe('ac:ac-1:Contacts searchable.')
    expect(lineMap.get('ep')).toBe('ep:outcome-contradiction-only')
    expect(lineMap.get('ap')).toBe('ap:full-auto')
  })
})

describe('buildRtkDelta', () => {
  it('builds a minimal delta with required fields only', () => {
    const delta = buildRtkDelta({ continuation_decision: 'continue' })
    expect(delta.v).toBe(1)
    expect(delta.continuation_decision).toBe('continue')
    expect(delta.brief_hash).toBeUndefined()
    expect(delta.brief_version).toBeUndefined()
    expect(delta.criteria_remaining).toEqual([])
    expect(delta.next_action).toBeUndefined()
    expect(delta.assumptions).toEqual([])
    expect(delta.handoff_notes).toBeUndefined()
  })

  it('cleans string inputs by trimming and collapsing whitespace', () => {
    const delta = buildRtkDelta({
      continuation_decision: 'continue',
      next_action: '  implement   the   search   filter  ',
      handoff_notes: '  some notes  ',
    })
    expect(delta.next_action).toBe('implement the search filter')
    expect(delta.handoff_notes).toBe('some notes')
  })

  it('filters empty strings from array fields', () => {
    const delta = buildRtkDelta({
      continuation_decision: 'continue',
      criteria_remaining: ['ac-1:Search works.', '', '   ', 'ac-2:Notes save.'],
      assumptions: ['', 'Repo is checked out.', '  '],
    })
    expect(delta.criteria_remaining).toEqual(['ac-1:Search works.', 'ac-2:Notes save.'])
    expect(delta.assumptions).toEqual(['Repo is checked out.'])
  })

  it('omits optional fields that are empty strings', () => {
    const delta = buildRtkDelta({
      continuation_decision: 'complete',
      brief_hash: '   ',
      next_action: '',
      handoff_notes: '',
    })
    expect(delta.brief_hash).toBeUndefined()
    expect(delta.next_action).toBeUndefined()
    expect(delta.handoff_notes).toBeUndefined()
  })

  it('includes optional fields when present', () => {
    const delta = buildRtkDelta({
      continuation_decision: 'escalate',
      brief_hash: 'abc123',
      brief_version: 4,
      criteria_remaining: ['ac-1:Done.'],
      next_action: 'Review the diff.',
      assumptions: ['Tests pass.'],
      handoff_notes: 'dec:escalated\nwhy:blocker found',
    })
    expect(delta.brief_hash).toBe('abc123')
    expect(delta.brief_version).toBe(4)
    expect(delta.criteria_remaining).toEqual(['ac-1:Done.'])
    expect(delta.next_action).toBe('Review the diff.')
    expect(delta.assumptions).toEqual(['Tests pass.'])
    expect(delta.handoff_notes).toBe('dec:escalated\nwhy:blocker found')
  })
})

describe('serializeRtkDeltaLines', () => {
  it('emits rtk_delta:v1 as the first line', () => {
    const lines = serializeRtkDeltaLines(buildRtkDelta({ continuation_decision: 'continue' }))
    expect(lines[0]).toBe('rtk_delta:v1')
  })

  it('always includes cd: line after header', () => {
    const lines = serializeRtkDeltaLines(buildRtkDelta({ continuation_decision: 'complete' }))
    expect(lines[1]).toBe('cd:complete')
  })

  it('omits lines for missing/empty optional fields', () => {
    const lines = serializeRtkDeltaLines(buildRtkDelta({ continuation_decision: 'continue' }))
    const keys = lines.map((line) => line.split(':')[0])
    expect(keys).not.toContain('bh')
    expect(keys).not.toContain('bv')
    expect(keys).not.toContain('cr')
    expect(keys).not.toContain('na')
    expect(keys).not.toContain('asm')
    expect(keys).not.toContain('hn')
  })

  it('serializes lists with pipe-delimited separator', () => {
    const delta = buildRtkDelta({
      continuation_decision: 'continue',
      criteria_remaining: ['ac-1:Search works.', 'ac-2:Notes save.'],
      assumptions: ['Repo checked out.', 'Tests passing.'],
    })
    const lines = serializeRtkDeltaLines(delta)
    expect(lines).toContain('cr:ac-1:Search works. | ac-2:Notes save.')
    expect(lines).toContain('asm:Repo checked out. | Tests passing.')
  })

  it('includes all optional scalar fields when present', () => {
    const delta = buildRtkDelta({
      continuation_decision: 'escalate',
      brief_hash: 'xyz789',
      brief_version: 2,
      next_action: 'Fix the blocker.',
      handoff_notes: 'dec:blocked\nwhy:external dep',
    })
    const lines = serializeRtkDeltaLines(delta)
    expect(lines).toContain('bh:xyz789')
    expect(lines).toContain('bv:2')
    expect(lines).toContain('na:Fix the blocker.')
    expect(lines).toContain('hn:dec:blocked\nwhy:external dep')
  })

  it('round-trip: check key presence and values', () => {
    const delta = buildRtkDelta({
      continuation_decision: 'continue',
      brief_hash: 'hash-abc',
      brief_version: 3,
      criteria_remaining: ['ac-1:Contacts searchable.'],
      next_action: 'Implement the filter.',
      assumptions: ['DB migrated.'],
    })
    const lines = serializeRtkDeltaLines(delta)
    const lineMap = new Map(lines.map((line) => [line.split(':')[0], line]))
    expect(lineMap.get('rtk_delta')).toBe('rtk_delta:v1')
    expect(lineMap.get('cd')).toBe('cd:continue')
    expect(lineMap.get('bh')).toBe('bh:hash-abc')
    expect(lineMap.get('bv')).toBe('bv:3')
    expect(lineMap.get('cr')).toBe('cr:ac-1:Contacts searchable.')
    expect(lineMap.get('na')).toBe('na:Implement the filter.')
    expect(lineMap.get('asm')).toBe('asm:DB migrated.')
  })
})

describe('formatHandoffNotes', () => {
  it('formats required fields only', () => {
    const notes = formatHandoffNotes({
      dec: 'Used JSON.stringify without replacer.',
      why: 'Replacer array acts as key allowlist and drops all nested fields.',
    })
    expect(notes).toBe(
      'dec:Used JSON.stringify without replacer.\nwhy:Replacer array acts as key allowlist and drops all nested fields.',
    )
  })

  it('includes rej and watch when present', () => {
    const notes = formatHandoffNotes({
      dec: 'Chose approach A.',
      why: 'Simpler and covers the full key space.',
      rej: 'Approach B — sorted replacer only covers top-level keys.',
      watch: 'If the spec gains circular refs, revisit.',
    })
    const lines = notes.split('\n')
    expect(lines).toHaveLength(4)
    expect(lines[2]).toBe('rej:Approach B — sorted replacer only covers top-level keys.')
    expect(lines[3]).toBe('watch:If the spec gains circular refs, revisit.')
  })

  it('omits rej and watch when empty', () => {
    const notes = formatHandoffNotes({
      dec: 'Ship it.',
      why: 'All criteria met.',
      rej: '   ',
      watch: '',
    })
    expect(notes.split('\n')).toHaveLength(2)
    expect(notes).not.toContain('rej:')
    expect(notes).not.toContain('watch:')
  })

  it('trims whitespace from field values', () => {
    const notes = formatHandoffNotes({
      dec: '  Trim me.  ',
      why: '  Because whitespace.  ',
    })
    expect(notes).toBe('dec:Trim me.\nwhy:Because whitespace.')
  })
})

describe('parseHandoffNotes', () => {
  it('parses notes produced by formatHandoffNotes', () => {
    const notes = formatHandoffNotes({
      dec: 'Used JSON.stringify without replacer.',
      why: 'Replacer drops nested keys.',
      rej: 'Sorted replacer approach.',
      watch: 'Circular refs in spec.',
    })
    const parsed = parseHandoffNotes(notes)
    expect(parsed?.dec).toBe('Used JSON.stringify without replacer.')
    expect(parsed?.why).toBe('Replacer drops nested keys.')
    expect(parsed?.rej).toBe('Sorted replacer approach.')
    expect(parsed?.watch).toBe('Circular refs in spec.')
  })

  it('returns null when dec is missing', () => {
    expect(parseHandoffNotes('why:Because it worked.')).toBeNull()
  })

  it('returns null when why is missing', () => {
    expect(parseHandoffNotes('dec:Chose approach A.')).toBeNull()
  })

  it('returns null for empty or unstructured notes', () => {
    expect(parseHandoffNotes('')).toBeNull()
    expect(parseHandoffNotes('Verifier should check X.')).toBeNull()
  })

  it('omits rej and watch fields when not present in the source', () => {
    const parsed = parseHandoffNotes('dec:Ship it.\nwhy:All criteria met.')
    expect(parsed).not.toBeNull()
    expect(parsed?.rej).toBeUndefined()
    expect(parsed?.watch).toBeUndefined()
  })

  it('round-trips through format then parse', () => {
    const original = {
      dec: 'Chose delta-only continuation.',
      why: 'Full brief re-send wastes tokens on run 2+.',
      rej: 'Full brief every run.',
      watch: 'If brief hash changes mid-sequence.',
    }
    expect(parseHandoffNotes(formatHandoffNotes(original))).toEqual(original)
  })
})
