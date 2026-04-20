# OpenFang Steal List
## What To Borrow For DewDrops + Paperclip

Date: 2026-04-18
Reference repo: `RightNow-AI/openfang` @ `d3d9fa8`

---

## Bottom Line

OpenFang is not interesting because it is Rust or because it claims big numbers.
It is interesting because it has three things we should copy:

1. A **packaged autonomous capability layer** (`Hands`)
2. A **small set of workflow primitives** that let agents operate without constant human routing
3. A **runtime hardening layer** that assumes autonomous loops will drift, repeat, or get corrupted

What we should **not** copy:

- the monolithic "one binary" rewrite
- benchmark theater
- the "40 channels" bragging as a primary product direction
- generic role templates as a substitute for real execution packages

Our current edge is still stronger in room-centric briefing and continuation:

- editable `BriefSpec` -> immutable `BriefPacket`
- RTK continuation patching
- issue-backed runtime with worktree isolation
- phone / world / desktop surfaces as one control plane

OpenFang's edge is the next layer above that:

- packaged autonomous jobs
- safer runtime loops
- stronger manifest discipline

---

## What OpenFang Actually Has

Verified in repo:

- Cargo workspace split across `openfang-kernel`, `openfang-runtime`, `openfang-api`, `openfang-memory`, `openfang-hands`, `openfang-skills`, and others in [openfang/Cargo.toml](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/openfang/Cargo.toml:1>)
- a real packaged "Hand" system with manifests and skill docs under:
  - [openfang/crates/openfang-hands/bundled/researcher/HAND.toml](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/openfang/crates/openfang-hands/bundled/researcher/HAND.toml:1>)
  - [openfang/crates/openfang-hands/bundled/researcher/SKILL.md](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/openfang/crates/openfang-hands/bundled/researcher/SKILL.md:1>)
- a workflow engine with `sequential`, `fan_out`, `collect`, `conditional`, and `loop` modes in [openfang/docs/workflows.md](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/openfang/docs/workflows.md:1>)
- loop guard and session repair in:
  - [openfang/crates/openfang-runtime/src/loop_guard.rs](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/openfang/crates/openfang-runtime/src/loop_guard.rs:1>)
  - [openfang/crates/openfang-runtime/src/session_repair.rs](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/openfang/crates/openfang-runtime/src/session_repair.rs:1>)
- capability-based security and inheritance enforcement in [openfang/crates/openfang-types/src/capability.rs](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/openfang/crates/openfang-types/src/capability.rs:1>)
- a Merkle-style audit chain in [openfang/crates/openfang-runtime/src/audit.rs](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/openfang/crates/openfang-runtime/src/audit.rs:1>)
- prompt-injection scanning for skills in:
  - [openfang/crates/openfang-skills/src/registry.rs](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/openfang/crates/openfang-skills/src/registry.rs:1>)
  - [openfang/crates/openfang-skills/src/verify.rs](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/openfang/crates/openfang-skills/src/verify.rs:1>)

---

## Steal Now

### 1. Capability Packs, Not Just Recipes

OpenFang's best product idea is not "agents."
It is **curated autonomous packages** with:

- manifest
- settings
- explicit tools
- long-form operating playbook
- approval model
- observable metrics

We currently have fragments of this:

- `BriefSpec` in [dewdrops/src/freeform/briefSpec.ts](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/dewdrops/src/freeform/briefSpec.ts:1>)
- `SwarmRecipe` in [dewdrops/src/freeform/swarmRecipes.ts](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/dewdrops/src/freeform/swarmRecipes.ts:1>)
- `CapabilityProfile` in `dewdrops/src/freeform/capabilityProfiles.ts`
- presets like `crm.ts`

What is missing:

- one first-class packaged unit that binds all of those together
- explicit operator-facing settings
- explicit metrics / status contract

Build next:

```ts
type CapabilityPack = {
  id: string
  label: string
  description: string
  briefTemplate: BriefSpec
  swarmRecipeId: string
  capabilityProfileId: string
  settingsSchema: PackSetting[]
  approvalPolicy: 'none' | 'machine-gate' | 'human-acceptance'
  outputContract: string[]
  metrics: string[]
}
```

Best initial packs:

- `crm-contacts`
- `crm-pipeline`
- `research-sweep`
- `audit-report`
- `ship-release`

Primary seams:

- [dewdrops/src/freeform/swarmRecipes.ts](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/dewdrops/src/freeform/swarmRecipes.ts:1>)
- [dewdrops/src/freeform/briefSpec.ts](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/dewdrops/src/freeform/briefSpec.ts:1>)
- `dewdrops/src/freeform/capabilityProfiles.ts`
- `dewdrops/src/freeform/presets/`
- `dewdrops/src/freeform/components/ProblemSwarmInspector.tsx`

### 2. Workflow Primitives Above Continuation

Our continuation loop is strong, but it is still mostly "one room, one next action."
OpenFang's workflow modes are the right minimal grammar to add above that:

- `fan_out`
- `collect`
- `conditional`
- `loop`

We should not copy their whole workflow engine.
We should add these as room-level orchestration hints.

Best shape:

```ts
type RoomExecutionMode =
  | { type: 'sequential' }
  | { type: 'fan_out' }
  | { type: 'collect' }
  | { type: 'conditional'; condition: string }
  | { type: 'loop'; until: string; maxIterations: number }
```

Primary seams:

- `dewdrops/src/freeform/types.ts`
- `dewdrops/src/freeform/continuationPolicy.ts`
- [paperclip/server/src/services/heartbeat.ts](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/paperclip/server/src/services/heartbeat.ts:1>)

### 3. Continuation Loop Guard

This one maps directly to our runtime.
OpenFang assumes agents will repeat themselves.
That assumption is correct.

Borrowed now:

- repeated continuation signatures are blocked in [paperclip/server/src/services/heartbeat.ts](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/paperclip/server/src/services/heartbeat.ts:1>)
- tests live in [paperclip/server/src/__tests__/heartbeat-loop-guard.test.ts](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/paperclip/server/src/__tests__/heartbeat-loop-guard.test.ts:1>)

Current behavior:

- if the same issue keeps returning `continuationDecision = continue`
- with the same `briefHash`
- and the same normalized `nextAction`
- Paperclip blocks the next auto-queue instead of letting the loop spin forever

This is a direct OpenFang-style runtime hardening win.

---

## Steal Next

### 4. Capability Inheritance and Tool Scope Enforcement

OpenFang gets one important thing right:
child work should not be able to exceed parent permissions.

We need the Paperclip equivalent:

- recipe -> role -> tool grants
- workspace / repo scope grants
- branch / worktree scope grants
- approval-bound actions

That should live in the runtime contract, not only in UI descriptions.

Primary seams:

- [dewdrops/src/freeform/swarmRecipes.ts](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/dewdrops/src/freeform/swarmRecipes.ts:1>)
- [paperclip/server/src/services/heartbeat.ts](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/paperclip/server/src/services/heartbeat.ts:1>)
- adapter config generation in Paperclip runtime

### 5. Prompt-Injection Scanning For Imported Skill / Pack Content

OpenFang scans skill prompt content before activation.
We should do the same for anything user-installable or pack-installable.

Targets:

- future DewDrops capability packs
- future shared prompts / skill bundles
- imported room templates

Do not overfit it into "AI safety."
Just block obvious malicious operator overrides and exfiltration bait before they reach runtime.

Primary seams:

- `dewdrops/src/freeform/` pack/template ingest
- `paperclip/server/src/services/company-skills.ts`
- adapter-utils shared validation helpers

### 6. Tamper-Evident Audit Chain For Runs

We already have issue comments, run logs, and run summaries.
What we do not have is a strong integrity story across them.

OpenFang's Merkle-style audit log is worth copying conceptually:

- each run references previous hash
- each artifact acceptance event references previous hash
- each escalation / rejection / continuation decision joins the same chain

This is especially valuable for:

- autonomous acceptance flows
- later multi-user systems
- proving what the agent actually did

Primary seams:

- [paperclip/server/src/services/heartbeat.ts](</Users/tylersteeves/Documents/Coding/App Development and Coding/Claw-Code/paperclip/server/src/services/heartbeat.ts:1>)
- run ledger persistence
- DewDrops room artifact projection

### 7. Session Repair For Broken Transcript History

OpenFang assumes message history will get corrupted or malformed and repairs it before continuing.
We should apply the same mindset to our continuation context and adapter result recovery.

We already do some result recovery in:

- `paperclip/server/src/services/heartbeat-run-summary.ts`
- adapter parsers

Next step is making session/context repair a first-class service rather than one-off parsing recovery.

---

## Probably Not Worth Stealing

### 1. Full Rust Rewrite

Wrong trade right now.
Our product risk is orchestration quality, not runtime language choice.

### 2. Huge Channel Surface Area

`40 channels` is not the moat.
Our better path is a few high-value operator surfaces:

- Desktop
- World
- Phone
- selected external connectors only when they matter

### 3. Generic Agent Role Catalogs

`architect`, `debugger`, `writer`, `planner` templates are fine, but not strategic.
We should prefer pack-level behavior over role cosplay.

---

## Recommended Build Order

1. Keep the new continuation loop guard
2. Add `CapabilityPack` as a first-class DewDrops record
3. Add workflow primitives: `fan_out`, `collect`, `conditional`, `loop`
4. Add recipe -> role -> tool scope enforcement in Paperclip
5. Add prompt-injection scan on imported packs / shared prompt assets
6. Add audit hash-chain for run and artifact acceptance history

---

## Recommendation

The correct OpenFang theft is:

- **steal the packaging model**
- **steal the workflow grammar**
- **steal the runtime paranoia**

Do **not** steal the monolith.
Do **not** chase their channel count.
Do **not** confuse generic agent templates with the real product.

Their strongest idea is:

> "Autonomous work should ship as a packaged capability, not as a prompt you remember to type."

That fits DewDrops extremely well.
