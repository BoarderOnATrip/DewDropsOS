import type { ChangeEvent } from 'react'

export type AcceptanceCriterion = {
  id: string
  description: string
  verificationHint: string
}

export type BriefCreative = {
  mission: string
  beneficiary: string
  audience: string
  tone: string
  references: string
}

export type BriefExecution = {
  task: string
  deliverables: string
  scopeIn: string
  scopeOut: string
  milestones: string
  dependencies: string
  criteria: AcceptanceCriterion[]
}

export type BriefEditorValue = {
  creative: BriefCreative
  execution: BriefExecution
}

export type AcceptanceCriteriaEditorProps = {
  value: BriefEditorValue
  onChange: (value: BriefEditorValue) => void
  label?: string
  description?: string
  emptyCriteriaLabel?: string
  className?: string
}

function newCriterionId(existing: readonly AcceptanceCriterion[]): string {
  const prefix = 'criterion'
  const taken = new Set(existing.map((criterion) => criterion.id))
  let index = existing.length + 1
  while (taken.has(`${prefix}-${index}`)) {
    index += 1
  }
  return `${prefix}-${index}`
}

function updateCreative(
  value: BriefEditorValue,
  patch: Partial<BriefCreative>,
): BriefEditorValue {
  return {
    ...value,
    creative: {
      ...value.creative,
      ...patch,
    },
  }
}

function updateExecution(
  value: BriefEditorValue,
  patch: Partial<BriefExecution>,
): BriefEditorValue {
  return {
    ...value,
    execution: {
      ...value.execution,
      ...patch,
    },
  }
}

function updateCriterion(
  value: BriefEditorValue,
  criterionId: string,
  patch: Partial<AcceptanceCriterion>,
): BriefEditorValue {
  return updateExecution(value, {
    criteria: value.execution.criteria.map((criterion) =>
      criterion.id === criterionId ? { ...criterion, ...patch } : criterion,
    ),
  })
}

export function AcceptanceCriteriaEditor({
  value,
  onChange,
  label = 'Brief editor',
  description = 'Write the creative context, then shape the execution brief and acceptance criteria.',
  emptyCriteriaLabel = 'No criteria yet. Add one to define how this room is judged complete.',
  className,
}: AcceptanceCriteriaEditorProps) {
  const addCriterion = () => {
    const nextCriteria = [
      ...value.execution.criteria,
      {
        id: newCriterionId(value.execution.criteria),
        description: '',
        verificationHint: '',
      },
    ]
    onChange(updateExecution(value, { criteria: nextCriteria }))
  }

  const removeCriterion = (criterionId: string) => {
    onChange(
      updateExecution(value, {
        criteria: value.execution.criteria.filter((criterion) => criterion.id !== criterionId),
      }),
    )
  }

  const onTextChange =
    (key: keyof BriefCreative | keyof BriefExecution) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = event.target.value
      if (key in value.creative) {
        onChange(updateCreative(value, { [key]: next } as Partial<BriefCreative>))
        return
      }
      if (key in value.execution) {
        onChange(updateExecution(value, { [key]: next } as Partial<BriefExecution>))
      }
    }

  return (
    <section className={['freeform-problem-inspector-section', className].filter(Boolean).join(' ')} aria-label={label}>
      <div className="freeform-toolbar-panel-problem">
        <div>
          <h3>{label}</h3>
          <p>{description}</p>
        </div>
      </div>

      <div className="freeform-problem-inspector-grid">
        <label className="freeform-field">
          <span>Mission</span>
          <textarea value={value.creative.mission} onChange={onTextChange('mission')} rows={3} />
        </label>
        <label className="freeform-field">
          <span>Beneficiary</span>
          <input type="text" value={value.creative.beneficiary} onChange={onTextChange('beneficiary')} />
        </label>
      </div>

      <div className="freeform-problem-inspector-grid">
        <label className="freeform-field">
          <span>Audience</span>
          <input type="text" value={value.creative.audience} onChange={onTextChange('audience')} />
        </label>
        <label className="freeform-field">
          <span>Tone</span>
          <input type="text" value={value.creative.tone} onChange={onTextChange('tone')} />
        </label>
      </div>

      <label className="freeform-field">
        <span>References</span>
        <textarea value={value.creative.references} onChange={onTextChange('references')} rows={3} />
      </label>

      <div className="freeform-problem-inspector-grid">
        <label className="freeform-field">
          <span>Task</span>
          <textarea value={value.execution.task} onChange={onTextChange('task')} rows={3} />
        </label>
        <label className="freeform-field">
          <span>Deliverables</span>
          <textarea value={value.execution.deliverables} onChange={onTextChange('deliverables')} rows={3} />
        </label>
      </div>

      <div className="freeform-problem-inspector-grid">
        <label className="freeform-field">
          <span>Scope in</span>
          <textarea value={value.execution.scopeIn} onChange={onTextChange('scopeIn')} rows={3} />
        </label>
        <label className="freeform-field">
          <span>Scope out</span>
          <textarea value={value.execution.scopeOut} onChange={onTextChange('scopeOut')} rows={3} />
        </label>
      </div>

      <div className="freeform-problem-inspector-grid">
        <label className="freeform-field">
          <span>Milestones</span>
          <textarea value={value.execution.milestones} onChange={onTextChange('milestones')} rows={3} />
        </label>
        <label className="freeform-field">
          <span>Dependencies</span>
          <textarea value={value.execution.dependencies} onChange={onTextChange('dependencies')} rows={3} />
        </label>
      </div>

      <div className="freeform-toolbar-panel-problem">
        <div>
          <h3>Acceptance criteria</h3>
          <p>Define the checks that prove the room is done.</p>
        </div>
        <button type="button" className="freeform-btn freeform-btn--tool" onClick={addCriterion}>
          Add criterion
        </button>
      </div>

      {value.execution.criteria.length === 0 ? (
        <p className="freeform-toolbar-panel-hint">{emptyCriteriaLabel}</p>
      ) : (
        <div className="freeform-mode-chip-row" aria-label="Acceptance criteria list">
          {value.execution.criteria.map((criterion, index) => (
            <article key={criterion.id} className="freeform-mode-chip" aria-label={`Criterion ${index + 1}`}>
              <div className="freeform-toolbar-panel-actions">
                <strong>Criterion {index + 1}</strong>
                <button
                  type="button"
                  className="freeform-btn freeform-btn--tool"
                  onClick={() => removeCriterion(criterion.id)}
                >
                  Remove
                </button>
              </div>
              <label className="freeform-field">
                <span>Description</span>
                <textarea
                  value={criterion.description}
                  onChange={(event) => onChange(updateCriterion(value, criterion.id, { description: event.target.value }))}
                  rows={3}
                  placeholder="What must be true for this to count as done?"
                />
              </label>
              <label className="freeform-field">
                <span>Verification hint</span>
                <input
                  type="text"
                  value={criterion.verificationHint}
                  onChange={(event) =>
                    onChange(updateCriterion(value, criterion.id, { verificationHint: event.target.value }))
                  }
                  placeholder="How the agent or human should verify it"
                />
              </label>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
