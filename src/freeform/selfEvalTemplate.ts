import type { BriefPacket } from './briefSpec'
import { formatHandoffNotes } from './rtk'

// Field-by-field guide for filling out a SelfEvaluation after each run.
export const SELF_EVAL_FIELDS_GUIDE: string = `
SELF-EVALUATION FIELDS
======================
alignmentSummary
  One sentence: what you did, and which part of the task it covers.
  Example: "Implemented the search index and wired it to the contact list UI, covering fast-search delivery."

criteriaChecks
  One entry per acceptance criterion in the brief.
  Fields: criterionId | met: true/false | evidence (specific artifact, test output, or observable fact) | confidence: high/medium/low
  Example: { criterionId: "ac-1", met: true, evidence: "perf.test.ts passes in 240ms p95", confidence: "high" }

criteriaCovered
  List of criterion IDs that are now fully met (including work from prior runs).

criteriaRemaining
  List of criterion IDs still unmet after this run.

allCriteriaMet
  true only when every criterion in the brief appears in criteriaCovered.

nextAction
  One sentence on what to do next and why. Set to null only when allCriteriaMet is true and no cleanup remains.

escalationReason
  Set to a string only if the brief itself contains an outcome-level contradiction that blocks forward progress.
  Do NOT use for technical uncertainty or ambiguity — resolve those yourself and log in assumptions[].
  Set to null in all other cases.

assumptions
  Non-obvious choices made during the run, in plain prose. Always include at least one entry if you made any judgment calls.
  Ambiguity and technical uncertainty belong here, not in escalationReason.

handoffNotes
  Structured reasoning for the next agent using dec/why/rej/watch format.
  dec: what decision or choice was locked in
  why: the constraint, observation, or tradeoff that made it right
  rej: what was considered and not chosen (omit if nothing notable)
  watch: what would make this choice worth revisiting (omit if nothing notable)
`.trim()

export function buildSelfEvalPromptSection(briefPacket: BriefPacket): string {
  const { execution, escalationPolicy, autonomyPolicy } = briefPacket
  const criteria = execution.acceptanceCriteria

  const criteriaBlock =
    criteria.length === 0
      ? '  (none — allCriteriaMet is true by default)'
      : criteria
          .map((ac) => {
            const hint = ac.verificationHint ? `\n  verify: ${ac.verificationHint}` : ''
            return `- ${ac.id}: ${ac.description}${hint}`
          })
          .join('\n')

  const handoffExample = formatHandoffNotes({
    dec: `[specific decision made while working on: ${execution.task}]`,
    why: '[constraint, observation, or tradeoff that made it the right call]',
    rej: '[what was considered but not chosen, and why]',
    watch: '[what would make this choice worth revisiting]',
  })

  return `
SELF-EVALUATION INSTRUCTIONS
=============================
Task: ${execution.task}

Escalation policy: ${escalationPolicy}
Autonomy policy: ${autonomyPolicy}

ACCEPTANCE CRITERIA (evaluate each one):
${criteriaBlock}

${SELF_EVAL_FIELDS_GUIDE}

HANDOFF NOTES FORMAT EXAMPLE (use dec/why/rej/watch):
${handoffExample}
(omit rej: and watch: lines if nothing notable)
`.trim()
}
