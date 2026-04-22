import { describe, expect, it } from 'vitest'
import {
  CRM_OPPORTUNITY_DELIVERABLES,
  CRM_OPPORTUNITY_MODULE_PLAN,
  CRM_OPPORTUNITY_READINESS_GATES,
  CRM_OPPORTUNITY_STAGE_FLOW,
} from './crmOpportunitiesPass'

describe('crmOpportunitiesPass', () => {
  it('defines a stage flow from intake through completion with evidence at each step', () => {
    expect(CRM_OPPORTUNITY_STAGE_FLOW.map((stage) => stage.id)).toEqual([
      'intake',
      'qualified',
      'scoped',
      'ready',
      'active',
      'completed',
    ])
    expect(CRM_OPPORTUNITY_STAGE_FLOW.every((stage) => stage.requiredEvidence.length > 0)).toBe(true)
    expect(CRM_OPPORTUNITY_STAGE_FLOW.every((stage) => stage.exitCriteria.length > 0)).toBe(true)
  })

  it('keeps CRM state canonical in Mira while aiButler and Paperclip stay in bounded roles', () => {
    expect(new Set(CRM_OPPORTUNITY_DELIVERABLES.map((deliverable) => deliverable.requiredByStage))).toEqual(
      new Set(['intake', 'qualified', 'scoped', 'ready', 'active', 'completed']),
    )
    expect(
      CRM_OPPORTUNITY_DELIVERABLES.filter((deliverable) => deliverable.sourceOfTruth === 'paperclip').map(
        (deliverable) => deliverable.syncPolicy,
      ),
    ).toEqual(['reference-only'])
    expect(
      CRM_OPPORTUNITY_DELIVERABLES.filter((deliverable) => deliverable.sourceOfTruth === 'aiButler').map(
        (deliverable) => deliverable.syncPolicy,
      ),
    ).toEqual(['derived'])
    expect(
      CRM_OPPORTUNITY_DELIVERABLES.filter((deliverable) => deliverable.sourceOfTruth === 'mira').every(
        (deliverable) => deliverable.syncPolicy === 'canonical',
      ),
    ).toBe(true)
  })

  it('plans the vertical slice from phone intake to completion briefing', () => {
    expect(CRM_OPPORTUNITY_MODULE_PLAN.map((slice) => slice.id)).toEqual([
      'phone-intake',
      'qualification-scope',
      'execution-lane',
      'completion-loop',
    ])
    expect(CRM_OPPORTUNITY_MODULE_PLAN[0]?.systems).toEqual(['aiButler', 'mira', 'dewdrops'])
    expect(CRM_OPPORTUNITY_MODULE_PLAN.at(-1)?.outputs).toContain('aiButler closure brief for the user-facing runtime.')
    expect(
      CRM_OPPORTUNITY_READINESS_GATES.some(
        (gate) => gate.id === 'orchestration-boundary' && gate.sourceOfTruth === 'paperclip',
      ),
    ).toBe(true)
  })
})
