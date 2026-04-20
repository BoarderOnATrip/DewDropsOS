# Brief Engine Architecture
## The 99designs Model Applied to Agentic Execution

---

## The Core Insight

99designs solved one of the hardest problems in services: **how do you hand work to a stranger and get a good outcome without constant back-and-forth?**

Their answer: a brief so structured that a designer who has never spoken to the client can execute, self-judge, and iterate — because every question the designer might ask is already answered in the brief.

We are building the same thing, except:
- The "designers" are AI agents
- The outputs are code, data, documents, and integrations — not logos
- The "review" is self-evaluation against the brief, not client feedback rounds
- The human's job is to **write good briefs and accept finished rooms** — nothing in between

This is the unlock for true swarm execution. Agents don't need a human in the loop for task questions. They need a brief that's complete enough to answer their own questions.

---

## The 99designs Brief Structure (adapted)

99designs captures six things in their intake. We map each to agent-executable fields:

| 99designs field | Their purpose | Our field | Agent use |
|---|---|---|---|
| What do you need? | Deliverable type | `task` | What I'm building |
| About your business | Identity context | `mission` + `beneficiary` | Why this matters, who benefits |
| What style? | Aesthetic target | `swarmRecipe` + `acceptanceCriteria` | How to judge "good" |
| What to include | Required elements | `scope.in` | Must be present |
| What to avoid | Anti-patterns | `scope.out` + `antiPatterns` | Failure conditions |
| Timeline / budget | Resources + urgency | `capabilityProfileId` + `milestone` | What I can use, when it's due |

The innovation they added that most people miss: **"Likes and dislikes" with examples.** Not just "what do you want" but "show me something good and something bad." We need the equivalent: `goodExamples` and `antiPatterns` as concrete references, not abstract constraints.

---

## BriefSpec Type

```typescript
// src/freeform/briefSpec.ts

export type BriefScope = {
  in: string[]   // explicitly included — must be delivered
  out: string[]  // explicitly excluded — do not touch
}

export type BriefExample = {
  label: string    // short name
  ref: string      // file path, URL, or artifact id
  note: string     // what's good/bad about this
  polarity: 'good' | 'bad'
}

export type AcceptanceCriterion = {
  id: string
  description: string        // testable condition
  verificationHint?: string  // how to check it (test, visual, metric)
}

// Escalation policy: one rule, not a union of cases.
// Only outcome-level contradiction is a valid escalation trigger.
// Ambiguity → agent resolves and documents in assumptions[].
// Technical uncertainty → agent makes best call and documents in assumptions[].
export type EscalationPolicy = 'outcome-contradiction-only'

export type BriefSpec = {
  // IDENTITY — why this exists (stable, set by human, rarely changes)
  mission: string              // the outcome this brief serves (one sentence)
  beneficiary: string          // who benefits and what they specifically need
  
  // DELIVERABLE — what success looks like (agents evaluate against this)
  task: string                 // specific output, one sentence, starts with a verb
  acceptanceCriteria: AcceptanceCriterion[]  // testable done-conditions
  
  // SCOPE — what's in and out
  scope: BriefScope
  antiPatterns: string[]       // concrete failure modes to avoid
  examples: BriefExample[]     // good and bad reference points
  
  // RESOURCES — what agents can use
  capabilityProfileId: string  // models, tools, budget tier
  swarmRecipeId: string        // team composition and role objectives
  
  // TIMELINE — where this fits
  milestone?: string           // sprint, phase, or named checkpoint
  dependsOn?: string[]         // room or task ids that must complete first
  blockedBy?: string[]         // things that must exist before this can start
  
  // POLICY
  escalationPolicy: EscalationPolicy  // always 'outcome-contradiction-only' for now
  
  // PROJECT CONTEXT
  projectId?: string           // parent project
}
// NOTE: targetRepo, targetBranch, and worktreeStrategy belong on SwarmRecipe
// (or an ExecutionBinding), NOT on BriefSpec. The brief describes outcome truth.
// The harness describes where and how work runs. Keep these separate.
```

---

## The Agent Self-Evaluation Loop

After every run, the agent executes this loop — **no human involved**:

```
1. READ  — what did I produce? (artifacts, code, docs)
2. CHECK — does my output satisfy each AcceptanceCriterion?
3. SCAN  — does the brief still make sense? is there a contradiction?
4. DECIDE — what's next?
   a. Criteria not fully met → continue on the same brief
   b. Criteria met, scope.in not exhausted → continue on remaining scope
   c. Brief fully satisfied → mark complete, surface for acceptance
   d. Brief produces bad outcome → ESCALATE with specific contradiction
5. WRITE — SelfEvaluation block into RunLedgerEntry
6. QUEUE — if continuing, auto-create next contract from brief + handoff
```

**The escalation rule — this is the only valid escalation:**

> "Executing this brief, as written, will produce outcome X.
> Outcome X directly contradicts stated goal Y.
> I cannot resolve this by making a judgment call.
> Human input required on the brief — not on the task."

Everything else the agent resolves and documents. Ambiguity is not an escalation trigger. Uncertainty is not an escalation trigger. Only **outcome-level contradiction** is an escalation trigger.

---

## SelfEvaluation Type (extends RunLedgerEntry)

```typescript
// Add to src/freeform/runLedger.ts

export type CriterionCheck = {
  criterionId: string
  met: boolean
  evidence: string    // what I produced that satisfies/fails this criterion
  confidence: 'high' | 'medium' | 'low'
}

export type SelfEvaluation = {
  alignmentSummary: string         // "I did X. Against the brief, this covers Y."
  criteriaChecks: CriterionCheck[] // one per AcceptanceCriterion
  allCriteriaMet: boolean
  nextAction: string | null        // "I'm going to do Z next because..." — null = done
  escalationReason: string | null  // ONLY outcome contradiction, else null
  assumptions: string[]            // judgment calls made instead of escalating
  handoffNotes: string             // reasoning for the next agent/run
}

// Extended RunLedgerEntry
// briefHash snapshots the compiled brief at run time — immutable per run.
// If the room brief changes mid-project, each run still knows exactly what
// brief it executed against. briefSpecId alone is not sufficient.
export type RunLedgerEntry = {
  // ... existing fields ...
  briefSpecId?: string         // which brief (mutable reference)
  briefVersion?: number        // version counter at time of run
  briefHash?: string           // content hash of briefPacket at run time
  selfEvaluation?: SelfEvaluation
  artifactStatus?: 'provisional' | 'accepted' | 'rejected'
}
```

---

## HandoffNotes Convention

`handoffNotes` is the agent-to-agent reasoning channel.

It is **not** for status. Status belongs in `alignmentSummary`. The next move belongs in `nextAction`. Judgment calls belong in `assumptions[]`.

`handoffNotes` is for the non-obvious design choice that the next agent should understand before continuing:

- What I chose
- Why I chose it
- What alternative I rejected
- What condition would make this worth revisiting

Recommended compact format:

```text
dec: chose A
why: constraint C made A safer/faster
rej: skipped B because it breaks D
watch: if E changes, reconsider B
```

Rules:

- Keep it short. Prefer 1-4 lines.
- Explain reasoning, not progress.
- Capture one consequential choice, not a changelog.
- If nothing non-obvious happened, leave it empty.

Examples:

```text
dec: kept brief hash as JSON.stringify(spec)
why: room brief is canonical and key order is already stable in this path
rej: skipped custom sorter because it adds complexity without changing current output
watch: if briefs start merging from multiple writers, revisit deterministic sorting
```

```text
dec: continued with SQLite for offline-first CRM seed
why: phone-first flow needs local reliability before sync exists
rej: skipped Postgres-first bootstrap because it adds setup without helping the first room
watch: if multi-user sync becomes in-scope, re-evaluate storage
```

This note should flow through the continuation wakeup as part of RTK result data, so the next run sees the reasoning directly instead of forcing the human to relay it.

---

## The Project Management Layer

Gantt / agile / waterfall are **brief structure templates**, not tracking tools.

They answer the question an agent will always ask at step 4: *"what's next?"*

| PM style | How it structures the brief | Agent reads it as |
|---|---|---|
| **Waterfall** | Sequential `dependsOn` chain | "I cannot start until X is done. After me, Y starts." |
| **Agile sprint** | Rooms grouped by `milestone`, sprint scope in `scope.in` | "I'm in Sprint 2. I only touch Sprint 2 items unless Sprint 1 is blocking me." |
| **Gantt** | `dependsOn` + estimated duration = critical path | "Am I on the critical path? Should I prioritize this over other scope?" |

All three resolve to the same agent behavior: **read the brief's dependency graph, pick the highest-value unblocked next action, do it.**

The human sets the PM structure once (sprint plan, Gantt, waterfall sequence). Agents navigate it themselves from that point.

---

## WorkflowCard Extension

```typescript
// Extend WorkflowCard in src/freeform/types.ts

export type WorkflowCard = {
  // ... existing fields ...
  
  /** Problem only: structured brief this room executes against */
  briefSpec?: BriefSpec
  
  /** Problem only: current brief version (increments on edit) */
  briefVersion?: number
  
  /** Problem only: brief is locked — agents cannot modify scope */
  briefLocked?: boolean
}
```

---

## Room Lifecycle (with Brief Engine)

```
DRAFT      → Human writes briefSpec (task, beneficiary, criteria, scope)
READY      → briefSpec complete, capabilityProfile + swarmRecipe selected
RUNNING    → agents executing, self-evaluating, auto-continuing
COMPLETE   → all AcceptanceCriteria met, no remaining scope.in items
ACCEPTED   → human reviewed artifacts and accepted the room output

ESCALATED is an exceptional side-path, not a linear stage:

  RUNNING ──→ ESCALATED ──→ (human corrects brief) ──→ READY ──→ RUNNING
                  ↑
                  only on outcome-level contradiction
                  ambiguity and uncertainty do NOT trigger this path
```

A room can cycle through `RUNNING → ESCALATED → READY → RUNNING` as many times as needed until the brief is clear. Each cycle produces a better brief — escalation is brief feedback, not task failure.

The human touches this lifecycle at **DRAFT**, **ESCALATED** (rare — signals a brief problem), and **ACCEPTED**. Everything on the main path between READY and COMPLETE is agents.

---

## What This Enables: The Stephanie CRM Example

Each CRM module is a room with a briefSpec:

**Room: Contact Management**
```
mission: "Give Stephanie instant access to her full contact history from her phone."
beneficiary: "Stephanie — real estate agent who needs to recall context before every call."
task: "Build a contact list with search, notes, last-contact date, and deal stage."
acceptanceCriteria:
  - Search returns results in < 300ms
  - Each contact shows last interaction and open deal
  - Notes can be added from phone in < 3 taps
scope.in: [contacts, search, notes, deal stage badge]
scope.out: [email integration, bulk import, team sharing]
antiPatterns:
  - Desktop-first UI that requires a keyboard
  - More than 2 taps to add a note
  - Any feature that needs wifi to load
```

An agent reads this and knows:
- What to build
- How to judge it
- What not to build
- What failure looks like
- When it's done

No human needed between brief and acceptance.

---

## Implementation Sequence for Codex

**Phase 1 — BriefSpec schema (Claude's lane)**
1. Add `BriefSpec`, `AcceptanceCriterion`, `BriefScope`, `BriefExample`, `EscalationPolicy` types to `src/freeform/briefSpec.ts`
2. Add `SelfEvaluation`, `CriterionCheck` types + `briefVersion`, `briefHash`, `assumptions`, `artifactStatus` to `src/freeform/runLedger.ts`
3. Add `briefSpec`, `briefVersion`, `briefLocked` to `WorkflowCard` in `src/freeform/types.ts`
4. Extend `SwarmRecipe` with `targetRepo`, `targetBranch`, `worktreeStrategy`, `continuationPolicy`, `reviewPolicy` in `src/freeform/swarmRecipes.ts` — execution binding lives here, not on BriefSpec
5. Extend `persistBoard.ts` to parse/persist `briefSpec`
6. Write tests: brief round-trips, criterion check builders, escalation policy invariants

**Phase 2 — Brief intake UI (UI worker's lane)**
1. `src/freeform/components/BriefEditor.tsx` — structured form, 99designs style
2. `src/freeform/components/AcceptanceCriteriaEditor.tsx`
3. `src/freeform/components/ScopeEditor.tsx`
4. Wire into `ProblemSwarmInspector.tsx`

**Phase 3 — Agent self-evaluation (Butler + bridge lane)**
1. Extend `CreateSwarmContractInput` to include full `briefSpec`
2. Butler receives brief, injects into agent system prompt
3. Agent writes `SelfEvaluation` block on run completion
4. `getSwarmRunReport` returns `selfEvaluation` in report
5. `buildRunLedgerEntry` parses and stores `selfEvaluation`

**Phase 4 — Continuation queue (orchestration lane)**
1. `buildContinuationContract(entry: RunLedgerEntry, brief: BriefSpec)` — creates next contract from self-eval's `nextAction`
2. Auto-queue on `allCriteriaMet === false && escalationReason === null`
3. Escalation surfaces as room tone `'missing'` in World OS
4. Acceptance flow: human reviews completed room artifacts and locks brief

**Phase 5 — Project management layer**
1. `ProjectPlan` type: rooms grouped by sprint/phase, with `dependsOn` graph
2. Gantt projection in World OS (new projection mode or fold view)
3. Agent reads `dependsOn` at step 4 of self-eval loop to pick next action
4. Critical path highlighting in Desktop board view

---

## The Vision in One Sentence

A human writes a brief. Agents execute, self-judge, and continue until the brief is satisfied. The human accepts the result. That's it.

This is what 99designs proved works for design. We're proving it works for everything.
