# Briefcase Model

## Core Shape

DewDrops should present the same intake shape regardless of domain.

The stable operator-facing flow is:

1. `Brief`
2. `Compartments`
3. `Build`
4. `Return`

The system adapts underneath for software, movies, campaigns, research, CRM work, or anything else. The intake experience should still feel the same.

## Terms

### Brief

The `Brief` is the overall thing being built from.

It is the top-level container for:

- `Problem Statement`
- `Desired Outcome`
- `North Star`
- `Canon`
- `Guidance`
- `Materials`
- `Approval Gates`

`Problem Statement` is one section inside the brief. It is not the whole container.

### Briefcase

`Briefcase` is the visual metaphor for the brief.

- Closed: compact project object with health, activity, and readiness signals.
- Open: unfolding world of activity, context, workers, and evidence.
- The AI works from what is inside the briefcase, not from ad hoc prompting.

### Compartments

`Compartments` are how the briefcase organizes materials.

They are not a separate concept from the brief. They are the brief's internal storage system for:

- source materials
- references
- data
- scripts
- shots
- capture media
- edits
- publish assets

Different domains can surface different compartments, but the interaction should remain consistent.

### Build

`Build` is the autonomous execution phase.

Agents should:

- reread the brief
- inspect the relevant compartments
- work
- self-evaluate
- continue when the next move is clear

The human should not need to micromanage normal ambiguity.

### Return

`Return` is intentionally rare.

The system should return to the human only when:

- the work is complete
- an approval gate is reached
- a mission-critical contradiction exists
- a real external blocker exists

Normal ambiguity should not trigger return.

## Canonical Brief Sections

Every domain-specific brief should map into these sections:

### Problem Statement

What is being made, for whom, and why it matters.

### Desired Outcome

What success looks like when the work is finished.

### North Star

What must remain true across runs.

### Canon

The authoritative facts, lore, continuity rules, and source truths the AI must stay loyal to until the human revises them.

### Guidance

How autonomous the system should be:

- guide gracefully
- milestone checkpoints
- let go completely

### Materials

The raw inputs and references loaded into compartments.

### Approval Gates

Named checkpoints where human approval is required before continuing or publishing.

## Product Rule

Use `Brief` and `Compartments` in user-facing language.

Internal implementation names like `briefCompartmentAssets` can remain temporarily if they reduce churn, but the product should speak in the briefcase vocabulary.

