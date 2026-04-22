import type { BriefSpec } from './briefSpec'

/** Problem = swarm target; agent = summonable unit; surface = generic board note */
export type CardKind = 'problem' | 'agent' | 'surface'

export type RunArtifactKind = 'report' | 'plan' | 'note' | 'error' | 'handoff' | 'image' | 'trace' | 'download'

// Artifact-level acceptance state. Acceptance is per-artifact, not per-run.
export type ArtifactStatus = 'provisional' | 'accepted' | 'rejected'

export type RunArtifact = {
  id: string
  runId: string
  kind: RunArtifactKind
  title: string
  summary: string
  content?: string
  path?: string
  mimeType?: string
  sizeBytes?: number
  createdAt: string
  status?: ArtifactStatus
}

export type CriterionCheck = {
  criterionId: string
  met: boolean
  evidence: string    // what the agent produced that satisfies or fails this criterion
  confidence: 'high' | 'medium' | 'low'
}

export type SelfEvaluation = {
  alignmentSummary: string          // "I did X. Against the brief, this covers Y."
  criteriaChecks: CriterionCheck[]  // one per AcceptanceCriterion in the brief
  allCriteriaMet: boolean
  criteriaCovered: string[]         // criterion ids satisfied this run
  criteriaRemaining: string[]       // criterion ids still pending
  nextAction: string | null         // what the agent is doing next and why; null = done
  escalationReason: string | null   // only outcome-level contradiction; else null
  assumptions: string[]             // judgment calls made instead of escalating; always present
  handoffNotes: string              // context for the next agent or run
}

export type RunLedgerEntry = {
  runId: string
  contractId: string
  roomId: string
  title: string
  status: string
  capabilityProfileId?: string
  swarmRecipeId?: string
  startedAt: string
  completedAt?: string
  artifacts: RunArtifact[]
  briefSpecId?: string
  briefVersion?: number
  briefHash?: string
  selfEvaluation?: SelfEvaluation
  continuationDecision?: 'continue' | 'complete' | 'escalate'
}

/** Who moves the agent on the board — you, or orchestration (future swarm scheduler). */
export type AgentManagement = 'manual' | 'auto'

export type AgentRuntimeKind = 'terminal' | 'service'

/** Mounted worker inside the envelope, e.g. Hermes, Codex, browser-harness, or a plain shell. */
export type AgentRuntimeProfile =
  | 'openclaw'
  | 'hermes'
  | 'ollama'
  | 'codex'
  | 'claude-code'
  | 'paperclip'
  | 'browser-harness'
  | 'browser-harness-js'
  | 'playwright'
  | 'custom'

export type AgentRuntimeTransport = 'cli' | 'api'

export type DewDropSessionApprovalGate = 'destructive' | 'external_network' | 'privileged'

export type DewDropSessionStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'blocked'
  | 'done'
  | 'failed'
  | 'killed'

export type DewDropSessionPolicy = {
  maxRuntimeMs?: number
  maxSteps?: number
  allowNetwork?: boolean
  writableRoots?: string[]
  requiresApprovalFor?: DewDropSessionApprovalGate[]
}

export type DewDropSessionState = {
  status: DewDropSessionStatus
  sessionId?: string
  pid?: string
  startedAt?: string
  lastHeartbeatAt?: string
  currentTask?: string
  cols?: number
  rows?: number
  outputVersion?: number
  terminalBuffer?: string
  logTail?: string[]
}

export type AgentRuntimeBinding = {
  kind: AgentRuntimeKind
  profile: AgentRuntimeProfile
  instanceLabel: string
  modelTag?: string
  command?: string
  vpnAlias?: string
  workspaceRoot?: string
  transport: AgentRuntimeTransport
  sessionPolicy?: DewDropSessionPolicy
  sessionState?: DewDropSessionState
}

export type SwarmTemplate = 'planning' | 'relationship' | 'operator' | 'research' | 'build'

export type DewDropsWorkspaceMode = 'desktop' | 'phone' | 'palace'

export type ButlerLaunchSurface = 'desktop' | 'phone' | 'hybrid'

export type MemoryPalaceLocusKind = 'north_star' | 'room' | 'portal' | 'artifact' | 'checkpoint'

export type MemoryPalaceLocus = {
  id: string
  title: string
  kind: MemoryPalaceLocusKind
  detail: string
}

export type BriefCompartmentKind =
  | 'north_star'
  | 'reference'
  | 'source'
  | 'data'
  | 'script'
  | 'shotlist'
  | 'capture'
  | 'edit'
  | 'publish'
  | 'social'
  | 'custom'

export type BriefCompartmentAssetStatus = 'sorted' | 'review'

export type BriefCompartmentAsset = {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
  addedAt: string
  compartmentId: string
  compartmentLabel: string
  compartmentKind: BriefCompartmentKind
  anchorRef: string
  extension?: string
  organizeStatus: BriefCompartmentAssetStatus
  organizeReason?: string
  matchedLocusId?: string
  sourceRunId?: string
  sourceArtifactId?: string
  sourcePath?: string
}

export type WorkflowCard = {
  id: string
  x: number
  y: number
  width: number
  height: number
  title: string
  /** Collapsed = icon strip; expanded = room for steps / agents */
  expanded: boolean
  color: string
  kind: CardKind
  /** Problem only: `panel` = rounded card (default); `bubble` = organic blob shape */
  problemShape?: 'bubble' | 'panel'
  /** Problem only: footprint before swarm mass is applied; inferred from size until first resize */
  problemBaseWidth?: number
  problemBaseHeight?: number
  /** Problem only: extra visual and interaction padding around the swarm membrane */
  swarmEnvelopePad?: number
  /** Problem only: preferred minimum width for assigned swarm cards */
  swarmAgentMinWidth?: number
  /** Agents only: attached problem after drag-combine; null = pool / unassigned */
  assignedToProblemId?: string | null
  /** Agents only: nested under another agent as a subagent (fractal swarm) */
  parentAgentId?: string | null
  /** Agents only: manual drag vs self-managed redeploy */
  management?: AgentManagement
  /** Agents only: terminal/session envelope for the actual worker behind this DewDrop */
  agentRuntime?: AgentRuntimeBinding
  /** Problem only: north-star brief (LifeGirdle-style); shown in card body */
  mission?: string
  /** Problem only: preferred Butler swarm template when launching from DewDrops */
  swarmTemplate?: SwarmTemplate
  /** Problem only: preferred Butler launch surface for this room */
  preferredLaunchSurface?: ButlerLaunchSurface
  /** Problem only: canonical Butler room binding for this board object */
  butlerRoomId?: string
  /** Problem only: latest Butler swarm contract launched from this board object */
  lastSwarmContractId?: string
  /** Problem only: latest Butler swarm run launched from this board object */
  lastSwarmRunId?: string
  /** Problem only: selected capability profile from the catalog */
  capabilityProfileId?: string
  /** Problem only: selected capability pack that binds profile, recipe, and launch defaults */
  capabilityPackId?: string
  /** Problem only: selected swarm recipe from the catalog */
  swarmRecipeId?: string
  /** Problem only: run history written back from Butler after each completed run */
  runLedger?: RunLedgerEntry[]
  /** Problem only: structured brief this room executes against (editable source of truth) */
  briefSpec?: BriefSpec
  /** Problem only: increments each time briefSpec is saved — used for BriefPacket versioning */
  briefVersion?: number
  /** Problem only: brief is locked — agents cannot modify scope mid-run */
  briefLocked?: boolean
  /** Problem only: Paperclip company used as the swarm control plane */
  paperclipCompanyId?: string
  /** Problem only: Paperclip project tied to the current execution lane */
  paperclipProjectId?: string
  /** Problem only: Paperclip agents to wake for this DewDrops room */
  paperclipAgentIds?: string[]
  /** Problem only: preferred lead inside the Paperclip swarm slice */
  paperclipLeadAgentId?: string
  /** Problem only: latest Paperclip issue created from this board object */
  lastPaperclipIssueId?: string
  /** Problem only: latest Paperclip heartbeat run triggered from this board object */
  lastPaperclipRunId?: string
  /** Problem only: Lifegirdle / MemPalace project wing backing this room */
  memoryWing?: string
  /** Problem only: Lifegirdle / MemPalace room inside the wing */
  memoryRoom?: string
  /** Problem only: compact context summary used for handoff packets and launches */
  memoryContextSummary?: string
  /** Problem only: key refs, compartments, or entities to pin into the handoff packet */
  memoryAnchors?: string[]
  /** Problem only: visual loci that hold context inside the memory palace */
  memoryPalaceLoci?: MemoryPalaceLocus[]
  /** Problem only: indexed intake materials dropped into this room's compartments */
  briefCompartmentAssets?: BriefCompartmentAsset[]
  /** Problem only: short brief for phone-first relay sessions */
  phoneRelayBrief?: string
  /** Problem only: short brief for deep desktop execution sessions */
  desktopSessionBrief?: string
  /** Uncertainties / decisions you owe — surfaced with a flash until you steer or resolve them */
  openQuestions?: string[]
  /** Specialist signals no useful work left — release needs lead nod too */
  releaseNodFromSpecialist?: boolean
  /** Problem lead agrees specialist can leave the sack */
  releaseNodFromLead?: boolean
  /** After dual-nod release, shown while marble is free in the pool */
  lastProjectRecall?: string
}

export type BoardCamera = {
  /** World coords at viewport center */
  x: number
  y: number
  zoom: number
}

/** Directed link from → to (decision branch, hub→spoke, dependency). */
export type BoardWire = {
  id: string
  fromCardId: string
  toCardId: string
}
