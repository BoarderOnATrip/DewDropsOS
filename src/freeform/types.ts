/** Problem = swarm target; agent = summonable unit; surface = generic board note */
export type CardKind = 'problem' | 'agent' | 'surface'

/** Who moves the agent on the board — you, or orchestration (future swarm scheduler). */
export type AgentManagement = 'manual' | 'auto'

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
  /** Problem only: key refs, drawers, or entities to pin into the handoff packet */
  memoryAnchors?: string[]
  /** Problem only: visual loci that hold context inside the memory palace */
  memoryPalaceLoci?: MemoryPalaceLocus[]
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
