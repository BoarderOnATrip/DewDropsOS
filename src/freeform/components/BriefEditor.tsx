import type { AcceptanceCriterion, AutonomyPolicy, BriefExample, BriefSpec } from '../briefSpec'

type BriefEditorProps = {
  value: BriefSpec
  onChange: (value: BriefSpec) => void
  disabled?: boolean
  title?: string
  subtitle?: string
}

const AUTONOMY_OPTIONS: Array<{ value: AutonomyPolicy; label: string }> = [
  { value: 'full-auto', label: 'Full auto' },
  { value: 'milestone-checkpoint', label: 'Milestone checkpoint' },
  { value: 'per-run-checkpoint', label: 'Per-run checkpoint' },
]

function updateCreative(value: BriefSpec, patch: Partial<BriefSpec['creative']>): BriefSpec {
  return {
    ...value,
    creative: {
      ...value.creative,
      ...patch,
    },
  }
}

function updateExecution(value: BriefSpec, patch: Partial<BriefSpec['execution']>): BriefSpec {
  return {
    ...value,
    execution: {
      ...value.execution,
      ...patch,
    },
  }
}

function updateStringList(
  list: readonly string[],
  index: number,
  nextValue: string,
): string[] {
  return list.map((item, itemIndex) => (itemIndex === index ? nextValue : item))
}

function nextList(list: readonly string[], nextValue = ''): string[] {
  return [...list, nextValue]
}

function removeListValue(list: readonly string[], index: number): string[] {
  return list.filter((_, itemIndex) => itemIndex !== index)
}

function nextReferenceId(index: number): string {
  return `reference-${index + 1}`
}

function nextCriterionId(criteria: readonly AcceptanceCriterion[]): string {
  const taken = new Set(criteria.map((criterion) => criterion.id))
  let index = criteria.length + 1
  while (taken.has(`criterion-${index}`)) {
    index += 1
  }
  return `criterion-${index}`
}

function updateReference(
  references: readonly BriefExample[],
  index: number,
  nextValue: BriefExample,
): BriefExample[] {
  return references.map((reference, referenceIndex) => (referenceIndex === index ? nextValue : reference))
}

function removeReference(references: readonly BriefExample[], index: number): BriefExample[] {
  return references.filter((_, referenceIndex) => referenceIndex !== index)
}

function updateCriterion(
  criteria: readonly AcceptanceCriterion[],
  index: number,
  nextValue: AcceptanceCriterion,
): AcceptanceCriterion[] {
  return criteria.map((criterion, criterionIndex) => (criterionIndex === index ? nextValue : criterion))
}

function removeCriterion(
  criteria: readonly AcceptanceCriterion[],
  index: number,
): AcceptanceCriterion[] {
  return criteria.filter((_, criterionIndex) => criterionIndex !== index)
}

export function BriefEditor({
  value,
  onChange,
  disabled = false,
  title = 'Brief',
  subtitle = 'Set the outcome once, then let agents reread the brief and judge themselves against it.',
}: BriefEditorProps) {
  const references = value.creative.references
  const criteria = value.execution.acceptanceCriteria
  const projectStructure = value.execution.projectStructure ?? []

  return (
    <section className="freeform-problem-inspector-section" aria-label={title}>
      <div className="freeform-toolbar-panel-problem">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <span className="freeform-run-pill">{references.length + criteria.length + projectStructure.length}</span>
      </div>

      <div
        className="freeform-problem-inspector-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
      >
        <div className="freeform-problem-inspector-section">
          <div className="freeform-toolbar-panel-problem">
            <div>
              <h3>Creative brief</h3>
              <p>Stable context: why this work matters, who it serves, and what good feels like.</p>
            </div>
          </div>

          <label className="freeform-field">
            <span>Mission</span>
            <textarea
              rows={3}
              value={value.creative.mission}
              onChange={(e) => onChange(updateCreative(value, { mission: e.target.value }))}
              disabled={disabled}
            />
          </label>

          <label className="freeform-field">
            <span>Beneficiary</span>
            <input
              type="text"
              value={value.creative.beneficiary}
              onChange={(e) => onChange(updateCreative(value, { beneficiary: e.target.value }))}
              placeholder="Who this room exists for"
              disabled={disabled}
            />
          </label>

          <label className="freeform-field">
            <span>Audience</span>
            <input
              type="text"
              value={value.creative.audience ?? ''}
              onChange={(e) => onChange(updateCreative(value, { audience: e.target.value || undefined }))}
              placeholder="Primary audience or stakeholder"
              disabled={disabled}
            />
          </label>

          <label className="freeform-field">
            <span>Tone</span>
            <input
              type="text"
              value={value.creative.tone ?? ''}
              onChange={(e) => onChange(updateCreative(value, { tone: e.target.value || undefined }))}
              placeholder="Clear, direct, trustworthy"
              disabled={disabled}
            />
          </label>

          <div className="freeform-toolbar-panel-problem">
            <div>
              <h3>References</h3>
              <p>Good and bad examples that let the agent triangulate quality.</p>
            </div>
            <button
              type="button"
              className="freeform-btn freeform-btn--tool"
              onClick={() =>
                onChange(
                  updateCreative(value, {
                    references: [
                      ...references,
                      {
                        label: nextReferenceId(references.length),
                        ref: '',
                        note: '',
                        polarity: 'good',
                      },
                    ],
                  }),
                )
              }
              disabled={disabled}
            >
              Add
            </button>
          </div>

          <div className="freeform-packet-list">
            {references.length === 0 ? (
              <p className="freeform-toolbar-panel-hint">No references yet.</p>
            ) : (
              references.map((reference, index) => (
                <article key={`${reference.label}-${index}`} className="freeform-run-list-item">
                  <div className="freeform-run-list-head">
                    <strong>{reference.label || `Reference ${index + 1}`}</strong>
                    <span className={`freeform-session-pill is-${reference.polarity}`}>
                      {reference.polarity === 'good' ? 'good' : 'bad'}
                    </span>
                  </div>

                  <div className="freeform-problem-inspector-grid">
                    <label className="freeform-field">
                      <span>Label</span>
                      <input
                        type="text"
                        value={reference.label}
                        onChange={(e) =>
                          onChange(
                            updateCreative(value, {
                              references: updateReference(references, index, {
                                ...reference,
                                label: e.target.value,
                              }),
                            }),
                          )
                        }
                        disabled={disabled}
                      />
                    </label>
                    <label className="freeform-field">
                      <span>Polarity</span>
                      <select
                        value={reference.polarity}
                        onChange={(e) =>
                          onChange(
                            updateCreative(value, {
                              references: updateReference(references, index, {
                                ...reference,
                                polarity: e.target.value as BriefExample['polarity'],
                              }),
                            }),
                          )
                        }
                        disabled={disabled}
                      >
                        <option value="good">good</option>
                        <option value="bad">bad</option>
                      </select>
                    </label>
                  </div>

                  <label className="freeform-field">
                    <span>Reference</span>
                    <input
                      type="text"
                      value={reference.ref}
                      onChange={(e) =>
                        onChange(
                          updateCreative(value, {
                            references: updateReference(references, index, {
                              ...reference,
                              ref: e.target.value,
                            }),
                          }),
                        )
                      }
                      placeholder="file, URL, artifact, or repo"
                      disabled={disabled}
                    />
                  </label>

                  <label className="freeform-field">
                    <span>Note</span>
                    <textarea
                      rows={2}
                      value={reference.note}
                      onChange={(e) =>
                        onChange(
                          updateCreative(value, {
                            references: updateReference(references, index, {
                              ...reference,
                              note: e.target.value,
                            }),
                          }),
                        )
                      }
                      disabled={disabled}
                    />
                  </label>

                  <button
                    type="button"
                    className="freeform-btn freeform-btn--tool"
                    onClick={() =>
                      onChange(
                        updateCreative(value, {
                          references: removeReference(references, index),
                        }),
                      )
                    }
                    disabled={disabled}
                  >
                    Remove reference
                  </button>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="freeform-problem-inspector-section">
          <div className="freeform-toolbar-panel-problem">
            <div>
              <h3>Execution brief</h3>
              <p>Work spec: the task, scope, checks, and handoff constraints agents must obey.</p>
            </div>
          </div>

          <label className="freeform-field">
            <span>Task</span>
            <textarea
              rows={3}
              value={value.execution.task}
              onChange={(e) => onChange(updateExecution(value, { task: e.target.value }))}
              disabled={disabled}
            />
          </label>

          <div className="freeform-problem-inspector-grid">
            <label className="freeform-field">
              <span>Autonomy policy</span>
              <select
                value={value.autonomyPolicy}
                onChange={(e) =>
                  onChange({
                    ...value,
                    autonomyPolicy: e.target.value as AutonomyPolicy,
                  })
                }
                disabled={disabled}
              >
                {AUTONOMY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="freeform-field">
              <span>Escalation policy</span>
              <input type="text" value={value.escalationPolicy} disabled />
            </label>
          </div>

          <div className="freeform-problem-inspector-grid">
            <label className="freeform-field">
              <span>Milestone</span>
              <input
                type="text"
                value={value.execution.milestone ?? ''}
                onChange={(e) => onChange(updateExecution(value, { milestone: e.target.value || undefined }))}
                placeholder="Sprint 1, Launch beta, or named checkpoint"
                disabled={disabled}
              />
            </label>
            <label className="freeform-field">
              <span>Deadline</span>
              <input
                type="text"
                value={value.execution.deadline ?? ''}
                onChange={(e) => onChange(updateExecution(value, { deadline: e.target.value || undefined }))}
                placeholder="2026-05-01 or milestone name"
                disabled={disabled}
              />
            </label>
            <label className="freeform-field">
              <span>Effort hint</span>
              <input
                type="text"
                value={value.execution.effortHint ?? ''}
                onChange={(e) => onChange(updateExecution(value, { effortHint: e.target.value || undefined }))}
                placeholder="small, medium, week-long"
                disabled={disabled}
              />
            </label>
          </div>

          <div className="freeform-toolbar-panel-problem">
            <div>
              <h3>Acceptance criteria</h3>
              <p>Agents self-judge against these after every run.</p>
            </div>
            <button
              type="button"
              className="freeform-btn freeform-btn--tool"
              onClick={() =>
                onChange(
                  updateExecution(value, {
                    acceptanceCriteria: [
                      ...criteria,
                      {
                        id: nextCriterionId(criteria),
                        description: '',
                      },
                    ],
                  }),
                )
              }
              disabled={disabled}
            >
              Add
            </button>
          </div>

          <ul className="freeform-packet-list">
            {criteria.length === 0 ? (
              <li>
                <p className="freeform-toolbar-panel-hint">No acceptance criteria yet.</p>
              </li>
            ) : (
              criteria.map((criterion, index) => (
                <li key={criterion.id} className="freeform-run-list-item">
                  <label className="freeform-field">
                    <span>Criterion</span>
                    <textarea
                      rows={2}
                      value={criterion.description}
                      onChange={(e) =>
                        onChange(
                          updateExecution(value, {
                            acceptanceCriteria: updateCriterion(criteria, index, {
                              ...criterion,
                              description: e.target.value,
                            }),
                          }),
                        )
                      }
                      disabled={disabled}
                    />
                  </label>
                  <label className="freeform-field">
                    <span>Verification hint</span>
                    <input
                      type="text"
                      value={criterion.verificationHint ?? ''}
                      onChange={(e) =>
                        onChange(
                          updateExecution(value, {
                            acceptanceCriteria: updateCriterion(criteria, index, {
                              ...criterion,
                              verificationHint: e.target.value || undefined,
                            }),
                          }),
                        )
                      }
                      disabled={disabled}
                    />
                  </label>
                  <button
                    type="button"
                    className="freeform-btn freeform-btn--tool"
                    onClick={() =>
                      onChange(
                        updateExecution(value, {
                          acceptanceCriteria: removeCriterion(criteria, index),
                        }),
                      )
                    }
                    disabled={disabled}
                  >
                    Remove criterion
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="freeform-problem-inspector-grid">
            <ListEditor
              label="Scope in"
              description="What the agent must deliver."
              values={value.execution.scope.in}
              onAdd={() =>
                onChange(
                  updateExecution(value, {
                    scope: {
                      ...value.execution.scope,
                      in: nextList(value.execution.scope.in),
                    },
                  }),
                )
              }
              onChangeValue={(index, nextValue) =>
                onChange(
                  updateExecution(value, {
                    scope: {
                      ...value.execution.scope,
                      in: updateStringList(value.execution.scope.in, index, nextValue),
                    },
                  }),
                )
              }
              onRemove={(index) =>
                onChange(
                  updateExecution(value, {
                    scope: {
                      ...value.execution.scope,
                      in: removeListValue(value.execution.scope.in, index),
                    },
                  }),
                )
              }
              disabled={disabled}
            />

            <ListEditor
              label="Scope out"
              description="What the agent must leave alone."
              values={value.execution.scope.out}
              onAdd={() =>
                onChange(
                  updateExecution(value, {
                    scope: {
                      ...value.execution.scope,
                      out: nextList(value.execution.scope.out),
                    },
                  }),
                )
              }
              onChangeValue={(index, nextValue) =>
                onChange(
                  updateExecution(value, {
                    scope: {
                      ...value.execution.scope,
                      out: updateStringList(value.execution.scope.out, index, nextValue),
                    },
                  }),
                )
              }
              onRemove={(index) =>
                onChange(
                  updateExecution(value, {
                    scope: {
                      ...value.execution.scope,
                      out: removeListValue(value.execution.scope.out, index),
                    },
                  }),
                )
              }
              disabled={disabled}
            />
          </div>

          <div className="freeform-problem-inspector-grid">
            <ListEditor
              label="Project structure"
              description="Webpages, apps, folders, and files the solution should end up with."
              values={projectStructure}
              onAdd={() =>
                onChange(
                  updateExecution(value, {
                    projectStructure: nextList(projectStructure),
                  }),
                )
              }
              onChangeValue={(index, nextValue) =>
                onChange(
                  updateExecution(value, {
                    projectStructure: updateStringList(projectStructure, index, nextValue),
                  }),
                )
              }
              onRemove={(index) =>
                onChange(
                  updateExecution(value, {
                    projectStructure: removeListValue(projectStructure, index),
                  }),
                )
              }
              disabled={disabled}
            />

            <ListEditor
              label="Deliverables"
              description="Concrete outputs the run must produce."
              values={value.execution.deliverables}
              onAdd={() => onChange(updateExecution(value, { deliverables: nextList(value.execution.deliverables) }))}
              onChangeValue={(index, nextValue) =>
                onChange(
                  updateExecution(value, {
                    deliverables: updateStringList(value.execution.deliverables, index, nextValue),
                  }),
                )
              }
              onRemove={(index) =>
                onChange(
                  updateExecution(value, {
                    deliverables: removeListValue(value.execution.deliverables, index),
                  }),
                )
              }
              disabled={disabled}
            />

            <ListEditor
              label="Anti-patterns"
              description="Failure modes the agent must avoid."
              values={value.execution.antiPatterns}
              onAdd={() => onChange(updateExecution(value, { antiPatterns: nextList(value.execution.antiPatterns) }))}
              onChangeValue={(index, nextValue) =>
                onChange(
                  updateExecution(value, {
                    antiPatterns: updateStringList(value.execution.antiPatterns, index, nextValue),
                  }),
                )
              }
              onRemove={(index) =>
                onChange(
                  updateExecution(value, {
                    antiPatterns: removeListValue(value.execution.antiPatterns, index),
                  }),
                )
              }
              disabled={disabled}
            />
          </div>

          <div className="freeform-problem-inspector-grid">
            <ListEditor
              label="Depends on"
              description="Rooms, artifacts, or tasks that must land first."
              values={value.execution.dependsOn ?? []}
              onAdd={() =>
                onChange(updateExecution(value, { dependsOn: nextList(value.execution.dependsOn ?? []) }))
              }
              onChangeValue={(index, nextValue) =>
                onChange(
                  updateExecution(value, {
                    dependsOn: updateStringList(value.execution.dependsOn ?? [], index, nextValue),
                  }),
                )
              }
              onRemove={(index) =>
                onChange(
                  updateExecution(value, {
                    dependsOn: removeListValue(value.execution.dependsOn ?? [], index),
                  }),
                )
              }
              disabled={disabled}
            />

            <ListEditor
              label="Blocked by"
              description="External blockers that stop execution."
              values={value.execution.blockedBy ?? []}
              onAdd={() =>
                onChange(updateExecution(value, { blockedBy: nextList(value.execution.blockedBy ?? []) }))
              }
              onChangeValue={(index, nextValue) =>
                onChange(
                  updateExecution(value, {
                    blockedBy: updateStringList(value.execution.blockedBy ?? [], index, nextValue),
                  }),
                )
              }
              onRemove={(index) =>
                onChange(
                  updateExecution(value, {
                    blockedBy: removeListValue(value.execution.blockedBy ?? [], index),
                  }),
                )
              }
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

type ListEditorProps = {
  label: string
  description: string
  values: readonly string[]
  onAdd: () => void
  onChangeValue: (index: number, value: string) => void
  onRemove: (index: number) => void
  disabled: boolean
}

function ListEditor({
  label,
  description,
  values,
  onAdd,
  onChangeValue,
  onRemove,
  disabled,
}: ListEditorProps) {
  return (
    <div>
      <div className="freeform-toolbar-panel-problem">
        <div>
          <h3>{label}</h3>
          <p>{description}</p>
        </div>
        <button type="button" className="freeform-btn freeform-btn--tool" onClick={onAdd} disabled={disabled}>
          Add
        </button>
      </div>

      <div className="freeform-packet-list">
        {values.length === 0 ? (
          <p className="freeform-toolbar-panel-hint">No items yet.</p>
        ) : (
          values.map((item, index) => (
            <div key={`${label}-${index}`} className="freeform-mode-chip-row">
              <label className="freeform-field" style={{ flex: 1 }}>
                <span>{`${label} ${index + 1}`}</span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => onChangeValue(index, e.target.value)}
                  disabled={disabled}
                />
              </label>
              <button
                type="button"
                className="freeform-btn freeform-btn--tool"
                onClick={() => onRemove(index)}
                disabled={disabled}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
