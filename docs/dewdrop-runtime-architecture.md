# DewDrop Runtime Architecture

## Goal

Each DewDrop is a real worker envelope.

The board owns:

- the briefcase
- approval and policy
- routing
- logs and artifacts
- swarm visibility

The worker inside the envelope stays replaceable.

## Runtime Rule

A DewDrop is not `OpenClaw`.

A DewDrop is:

- one terminal envelope
- one runtime profile
- one host route
- one policy boundary
- one observable session

That lets the same DewDrop run:

- `hermes`
- a plain shell
- `codex`
- `claude`
- `browser-harness`
- `browser-harness-js`
- `playwright`
- anything custom

## Browser Workers

For browser execution, DewDrops should use `browser-use/browser-harness` or `browser-harness-js` as worker backends, not as the control plane.

Hermes fits above that layer as the host-level node agent when a DewDrop should run memory, skills, or remote backend selection on the node itself.

Why:

- they are MIT-licensed
- they are thin
- they stay close to Chrome/CDP
- they let the worker solve real browser tasks instead of pretending the web is an API

Recommended split:

- `browser-harness` when the worker benefits from editable Python helpers and a self-healing wrapper
- `browser-harness-js` when the worker should stay close to raw CDP and fit a TS-heavy stack

## VPN Host Layer

The VPN is host fabric, not application logic.

DewDrops should treat the VPN as the routing plane that lets a DewDrop land on:

- your laptop
- a workstation
- a GPU box
- a browser machine
- an editing/render machine
- a container or ephemeral node

The clean host model is:

1. local DewDrop runtime on the operator machine
2. optional VPN host alias on the DewDrop
3. SSH over the VPN when a host alias is present

DewDrops should maintain a host registry so operators target known machines like `builder-01` or `browser-01` instead of opaque aliases.

That keeps the control plane simple:

- no remote agent daemon is required for the first useful version
- the same DewDrop UI works for local and remote workers
- logs and stdin/stdout still stream through the same session bridge

## Recommended Network Stack

If the current VPN server is flexible enough, DewDrops should still present the host layer in Tailscale terms:

- `Tailscale SSH` for identity-based SSH
- `ephemeral nodes` for short-lived worker machines and containers
- `Headscale` only if you want a self-hosted control plane instead of Tailscale SaaS

That gives DewDrops:

- identity-based host access
- simple node naming
- disposable workers
- a clean path to private fleet growth

## First Implementation Slice

The first real slice is:

1. compile runtime bindings into explicit launch plans
2. support local and VPN-routed launches through the same runtime bridge
3. treat browser workers as first-class runtime profiles

That is enough to make a DewDrop:

- local shell: `zsh -i -f`
- local browser worker: `browser-harness`
- remote browser worker: `browser-harness` on `builder-01` over VPN SSH

DewDrops should also surface bootstrap plans directly in the terminal inspector so the operator can prepare a Hermes or browser node without leaving the board.

Playwright belongs in the same family of browser workers:

- `playwright` when the worker should run repeatable browser tests, traces, and automation scripts
- `browser-harness` when the worker benefits from editable Python helpers and a self-healing wrapper
- `browser-harness-js` when the worker should stay close to raw CDP and fit a TS-heavy stack

## What DewDrops Should Build

DewDrops should build:

- brief compilation
- session policy
- approval gates
- swarm routing
- artifact capture
- host and runtime binding
- observability across workers

## What DewDrops Should Integrate

DewDrops should integrate:

- browser worker backends
- VPN / zero-trust host routing
- remote machines
- model-specific CLIs

## Near-Term Next Steps

1. Add runtime presets in the briefcase so rooms can request browser, coding, media, or research workers intentionally.
2. Add per-host health and lease state so DewDrops knows which machines are actually available.
3. Add artifact capture for browser runs: screenshots, page notes, downloaded files, and citations back into the briefcase.
4. Add host pools and ephemeral worker provisioning once the VPN host path is stable.
5. Add a local clipboard relay companion so copy/paste, secrets, and one-shot operator handoffs stay inside a DewDrops-owned safety layer.
