import type { ButlerSwarmTemplate } from '../lib/butlerBridge'

export type SwarmRecipeKind = 'research' | 'build' | 'review' | 'audit' | 'ship'

export type SwarmRecipeRole = {
  role: string
  objective: string
  toolHints?: string[]
}

export type WorktreeStrategy = 'per-agent' | 'per-recipe' | 'shared'

export type SwarmRecipe = {
  id: string
  label: string
  kind: SwarmRecipeKind
  description: string
  template: ButlerSwarmTemplate
  roles: SwarmRecipeRole[]
  tags: string[]
  // Execution binding — where and how work runs.
  // Optional for now; Butler support lands in a later phase.
  targetRepo?: string
  targetBranch?: string
  worktreeStrategy?: WorktreeStrategy
  continuationPolicy?: string  // e.g. 'auto-continue', 'milestone-gate'
  reviewPolicy?: string        // e.g. 'machine-gate', 'human-acceptance'
}

export const SWARM_RECIPES: readonly SwarmRecipe[] = [
  {
    id: 'research-sweep',
    label: 'Research sweep',
    kind: 'research',
    description: 'Parallel web and document research followed by a synthesis report.',
    template: 'research',
    roles: [
      {
        role: 'researcher',
        objective: 'Search the web and read source documents to gather relevant facts.',
        toolHints: ['web_search', 'read_url'],
      },
      {
        role: 'synthesizer',
        objective: 'Read researcher findings and produce a structured summary report.',
        toolHints: ['read_file'],
      },
    ],
    tags: ['research', 'read-only'],
    worktreeStrategy: 'shared',
    continuationPolicy: 'milestone-gate',
    reviewPolicy: 'human-acceptance',
  },
  {
    id: 'build-review-ship',
    label: 'Build → review → ship',
    kind: 'build',
    description: 'Builder implements, reviewer audits, then a ship step publishes.',
    template: 'build',
    roles: [
      {
        role: 'builder',
        objective: 'Implement the scoped changes according to the provided spec.',
        toolHints: ['bash', 'write_file', 'read_file'],
      },
      {
        role: 'reviewer',
        objective: 'Review the implementation for correctness, safety, and coverage.',
        toolHints: ['read_file'],
      },
      {
        role: 'shipper',
        objective: 'Run tests and publish the verified build.',
        toolHints: ['bash'],
      },
    ],
    tags: ['build', 'write', 'ship'],
    worktreeStrategy: 'per-recipe',
    continuationPolicy: 'auto-continue',
    reviewPolicy: 'machine-gate',
  },
  {
    id: 'audit-report',
    label: 'Audit & report',
    kind: 'audit',
    description: 'Code or document audit with a written findings report.',
    template: 'planning',
    roles: [
      {
        role: 'auditor',
        objective: 'Read and evaluate all relevant artifacts against the stated criteria.',
        toolHints: ['read_file', 'web_search'],
      },
      {
        role: 'reporter',
        objective: 'Compile auditor findings into an actionable report with prioritized issues.',
        toolHints: ['write_file'],
      },
    ],
    tags: ['audit', 'read-only', 'report'],
    worktreeStrategy: 'shared',
    continuationPolicy: 'milestone-gate',
    reviewPolicy: 'machine-gate',
  },
  {
    id: 'operator-relay',
    label: 'Operator relay',
    kind: 'review',
    description: 'Single operator loop for triage, decisions, and quick relay.',
    template: 'operator',
    roles: [
      {
        role: 'operator',
        objective: 'Execute triage decisions and relay any required actions or escalations.',
        toolHints: ['bash', 'read_file', 'write_file'],
      },
    ],
    tags: ['operator', 'relay'],
    worktreeStrategy: 'shared',
    continuationPolicy: 'auto-continue',
    reviewPolicy: 'human-acceptance',
  },
  {
    id: 'relationship-map',
    label: 'Relationship map',
    kind: 'research',
    description: 'Map entities, actors, and relationships from available context.',
    template: 'relationship',
    roles: [
      {
        role: 'mapper',
        objective: 'Identify all entities, actors, and relationships present in the room context.',
        toolHints: ['read_file', 'web_search'],
      },
      {
        role: 'verifier',
        objective: 'Cross-check the relationship map against source documents for accuracy.',
        toolHints: ['read_file'],
      },
    ],
    tags: ['research', 'relationship', 'read-only'],
    worktreeStrategy: 'shared',
    continuationPolicy: 'auto-continue',
    reviewPolicy: 'human-acceptance',
  },
] as const

export function getSwarmRecipe(id: string): SwarmRecipe | undefined {
  return SWARM_RECIPES.find((recipe) => recipe.id === id)
}

export function listSwarmRecipes(): readonly SwarmRecipe[] {
  return SWARM_RECIPES
}

export function listSwarmRecipesByKind(kind: SwarmRecipeKind): SwarmRecipe[] {
  return SWARM_RECIPES.filter((recipe) => recipe.kind === kind)
}
