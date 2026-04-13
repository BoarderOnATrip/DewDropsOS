/** Problem = swarm target; agent = summonable unit; surface = generic board note */
export type CardKind = 'problem' | 'agent' | 'surface'

/** Who moves the agent on the board — you, or orchestration (future swarm scheduler). */
export type AgentManagement = 'manual' | 'auto'

export type SwarmTemplate = 'planning' | 'relationship' | 'operator' | 'research' | 'build'

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
  /** Problem only: canonical Butler room binding for this board object */
  butlerRoomId?: string
  /** Problem only: latest Butler swarm contract launched from this board object */
  lastSwarmContractId?: string
  /** Problem only: latest Butler swarm run launched from this board object */
  lastSwarmRunId?: string
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
