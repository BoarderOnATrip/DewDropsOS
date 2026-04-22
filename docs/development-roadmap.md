# DewDrops Development Roadmap

## North Star

DewDrops becomes the control plane for real swarms.

The briefcase defines the problem.
The DewDrops route live workers.
Workers operate across local machines, remote hosts, and browser environments.
The human stays in charge of intent, approvals, and review rather than micromanaging execution.

## Stack Decision

Use the strongest language for each layer instead of forcing one language everywhere.

### Control Plane

- `TypeScript`
- `React + Vite`
- local Node runtime bridge today

Why:

- the product is already browser-first
- terminal/session control fits Node well
- the UI, runtime bridge, and orchestration surface stay in one language

### Worker Runtimes

- `Python` first for custom agent runtimes
- `Hermes` as the default node agent
- CLI-native workers where they already exist (`codex`, `claude`, `browser-harness`, `playwright`, media tools)

Why:

- Hermes and browser-harness are already strongest in Python
- the LLM tooling ecosystem is still best in Python
- DewDrops only needs a stable terminal/session envelope around them
- Playwright already solves the repeatable multi-browser execution problem better than a homegrown browser runner would

### Infra / Trusted Core

- keep `Rust` optional for later narrow subsystems only

Examples:

- hardened PTY/session daemon
- sandbox sidecar
- high-throughput artifact/indexing service

Do not rewrite the whole product in Rust.

## Product Architecture

### DewDrops Owns

- briefcase intake
- policy and approval gates
- worker routing
- room/session state
- artifact visibility
- swarm status
- human review surface

### Hosts Own

- compute
- installed runtimes
- local files
- browser instances
- model/provider credentials

### Hermes Owns

- host-level agent runtime
- skills and memory
- terminal backend choice
- remote execution modes

### Browser Backends Own

- direct browser execution
- CDP control
- cloud browser sessions when needed

## Current Runtime Model

Implemented now:

- each DewDrop is a terminal envelope
- each DewDrop can launch locally or over VPN SSH
- browser workers are first-class runtime profiles, including Playwright
- host alias is part of the DewDrop model

Immediate next:

- Hermes becomes a first-class runtime profile and node concept
- browser nodes and coding nodes become easy presets instead of manual shell editing

## Milestones

### Phase 1: Real Worker Envelopes

Status: in progress

- live DewDrop terminals
- runtime profiles
- local launch
- VPN/SSH launch
- basic session policy

### Phase 2: Node Templates

Status: active next

- `Shell` node
- `Hermes` node
- `Browser Harness` node
- `Browser JS` node
- `Playwright` node
- clear host targeting

### Phase 3: Host Fabric

- stable VPN naming
- DewDrops host registry with known machine aliases
- host health
- host pools
- ephemeral worker nodes
- remote bootstrap flows
- DewDrop-visible bootstrap plans for Hermes and browser nodes
- clipboard relay companion for operator copy/paste and secret handoff

### Phase 4: Briefcase Intake Upgrade

- real file ingest
- parsing and chunking
- citations and provenance
- artifacts back into compartments

### Phase 5: Swarm Loop

- plan
- assign
- execute
- evaluate
- continue / escalate / complete

### Phase 6: Artifact Bus

- typed handoffs between workers
- acceptance checks
- review queues
- publish gates

## Immediate Build Order

1. Make runtime presets obvious on each DewDrop.
2. Add Hermes-backed node templates.
3. Bind DewDrop hosts to the actual VPN fabric.
4. Add browser-node setup flow.
5. Add host health and lease state.
6. Add clipboard relay for safe operator handoffs and secret paste flows.
7. Upgrade intake from metadata sorting to real ingest.

## Current Working Rule

Do not add more abstract “agent framing.”

Ship concrete operating surfaces:

- a better briefcase
- clearer worker types
- stable host routing
- real artifacts
- real continuation logic

## Files To Watch

- `src/freeform/types.ts`
- `src/freeform/agentRuntime.ts`
- `src/freeform/BoardView.tsx`
- `src/freeform/components/DewDropTerminalCard.tsx`
- `src/lib/workerTerminalLaunch.ts`
- `src/lib/runtimeSessionStore.ts`
- `src/freeform/sessionBlueprint.ts`
- `src/freeform/briefCompartments.ts`
- `src/freeform/runLedger.ts`
- `src/freeform/continuationPolicy.ts`

## Definition Of “Across The Finish Line”

DewDrops is across the line when:

- a human can define a problem cleanly in the briefcase
- workers can be spun up locally or remotely without tool surgery
- browser work and coding work both run as first-class DewDrops
- artifacts return into the briefcase with provenance
- the swarm can continue intelligently without constant human babysitting
