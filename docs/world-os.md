# World OS for DewDrops

## Purpose
DewDrops is not a generic app shell. It is an agentic engineering harness and the first product surface for a `World OS`: a spatial operating system where context stays attached to the people, places, things, and work that matter.

The product goal is to evolve DewDrops from a CRM into a persistent context environment for super-users, operators, and agents. The UI should feel like moving through rooms in a world, not browsing folders in a tree.

## Product Principles
- Rooms instead of folders.
- Context is attached to actors, not trapped in documents.
- Every object has a stable spatial home and a machine-readable projection.
- Desktop is for depth. Phone is for relay. 3D is for immersion.
- Agents are first-class workers inside the same world model.
- Privacy comes from scoped projections and encryption, not from obscurity.

## Ontology
The core object model should stay small and explicit.

- `Wing`: a territory of work or memory, usually a domain, client space, or operating zone.
- `Actor`: anything that participates in context and change. This is the supertype.
- `LifeForm`: a biological `Actor`.
- `Person`: a human `LifeForm`.
- `Organization`: a collective `Actor` such as a company, family, team, or institution.
- `Agent`: a synthetic `Actor` that can act, report, and leave traces.
- `Room`: a contextual workspace around one or more actors, goals, or accounts.
- `Locus`: a stable point inside a room with a defined job.
- `Artifact`: an inert object such as a note, transcript, image, doc, plan, or receipt.
- `Tunnel`: a typed connection between wings, actors, rooms, or loci.
- `Projection`: a view of the same graph in 3D, fold, outline, packet, or raw form.

Guidance:
- `Person` and `Agent` should be first-class, not hidden inside `Artifact`.
- `LifeForm` can branch into `Person`, `Animal`, and `Plant` without changing the rest of the graph model.
- `Computer` is an `Artifact`; software workers running on it are `Agent`s.
- `Room` and `Person` are related graph nodes, not strict parent/child folders.

## Projection System
The same underlying record should render into multiple projections.

- `World view`: spatial 3D placement for navigation and memory.
- `Room view`: the main working surface for a single context.
- `Fold view`: a compact 2D projection that can be unfolded back into structure.
- `Outline view`: readable summary for review, search, and handoff.
- `Packet view`: dense machine context for agents and device relay.
- `Raw view`: the canonical encrypted record.

Projection rules:
- Projections must be reversible when possible.
- Projections can omit detail, but they cannot invent state.
- Different devices can receive different projections of the same room.
- A projection is a UI contract; the underlying graph remains canonical.

## Context Tunnels
Tunnels are how context moves across the world model.

Use tunnels to connect:
- `Person -> Room`
- `Room -> Room`
- `Wing -> Wing`
- `Actor -> Artifact`
- `Locus -> Locus`

Tunnel behavior:
- typed, named, and directional
- readable by humans
- queryable by agents
- safe to traverse only when the projection allows it
- able to carry short-lived context, not just static links

Examples:
- account room to renewal room
- person to decision log
- phone relay checkpoint to desktop execution room
- issue room to Paperclip execution lane

## Device Surfaces
Each device should project the same world differently.

- `Desktop`: dense operator surface for heavy work, swarm orchestration, and room editing.
- `Phone`: narrow relay surface for capture, review, approvals, and quick handoff.
- `Tablet`: review and presentation surface with a room-first layout.
- `3D globe`: future world navigation surface for Earth-scale context and continuity.

Surface rules:
- Phone should never require full desktop complexity.
- Desktop should preserve all graph depth.
- Surfaces should share the same underlying room state.
- The user should be able to resume from the last known attention point.

## Privacy And Safety
This system should be private by default and secure by design.

- Encrypt canonical storage at rest and transport in transit.
- Scope projections by user, device, role, and agent.
- Keep drafts local until the user or policy promotes them to shared state.
- Log agent actions and room transitions.
- Use signed, auditable handoffs for work that changes state.

Important boundary:
- Projection is not encryption.
- Origami-style folding and spatial hiding improve usability and cognitive privacy, but they do not replace real security controls.

Safety model:
- `Local draft`: only on the current device.
- `Shared room`: visible to allowed collaborators.
- `Agent view`: minimal context required to act.
- `Audit view`: immutable trace of actions and outcomes.

## CRM To Spatial OS
DewDrops should evolve in stages.

1. CRM phase: people, accounts, tasks, and notes stay attached to rooms.
2. Relay phase: phone and desktop share the same room, but different projections.
3. Agent phase: agents operate inside rooms and leave durable execution traces.
4. World phase: rooms become navigable territories across a winged map.
5. OS phase: the UI becomes the primary place where context, work, and memory are organized.

What changes from CRM:
- records become rooms
- contacts become actors
- notes become artifacts
- relationships become tunnels
- views become projections
- work becomes a persistent spatial state

## MVP Direction
The first shippable World OS slice for DewDrops should include:
- one wing
- one room model
- actor, artifact, and agent records
- tunnel links between rooms and people
- desktop and phone projections
- a memory palace overlay for durable context
- encrypted persistence with scoped sharing

The product test is simple: if a user can return days later and immediately understand where they are, who is involved, what changed, and what to do next, the world model is working.
