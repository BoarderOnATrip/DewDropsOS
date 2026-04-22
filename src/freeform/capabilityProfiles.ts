export type CapabilityProfileKind = 'research' | 'build' | 'review' | 'ship' | 'ops'

export type CapabilityProfile = {
  id: string
  label: string
  kind: CapabilityProfileKind
  description: string
  preferredModel?: string
  tools: string[]
  budgetHint?: string
  tags: string[]
}

export const CAPABILITY_PROFILES: readonly CapabilityProfile[] = [
  {
    id: 'research-standard',
    label: 'Research',
    kind: 'research',
    description: 'Web search, document reading, and synthesis. No write access.',
    tools: ['web_search', 'read_file', 'read_url'],
    budgetHint: 'low',
    tags: ['research', 'read-only'],
  },
  {
    id: 'build-local',
    label: 'Build (local)',
    kind: 'build',
    description: 'Full code execution, file writes, and shell access on the local machine.',
    tools: ['bash', 'read_file', 'write_file', 'web_search'],
    budgetHint: 'medium',
    tags: ['build', 'local', 'write'],
  },
  {
    id: 'review-read-only',
    label: 'Review',
    kind: 'review',
    description: 'Code and document review with no write access.',
    tools: ['read_file', 'web_search'],
    budgetHint: 'low',
    tags: ['review', 'read-only'],
  },
  {
    id: 'ship-verified',
    label: 'Ship',
    kind: 'ship',
    description: 'Verified release pipeline: build, test, tag, and push.',
    tools: ['bash', 'read_file', 'write_file'],
    budgetHint: 'medium',
    tags: ['ship', 'write', 'verified'],
  },
  {
    id: 'ops-diagnostic',
    label: 'Ops (diagnostic)',
    kind: 'ops',
    description: 'Diagnostic and observability access with read-only file and log inspection.',
    tools: ['bash', 'read_file', 'web_search'],
    budgetHint: 'low',
    tags: ['ops', 'diagnostic'],
  },
] as const

export function getCapabilityProfile(id: string): CapabilityProfile | undefined {
  return CAPABILITY_PROFILES.find((profile) => profile.id === id)
}

export function listCapabilityProfiles(): readonly CapabilityProfile[] {
  return CAPABILITY_PROFILES
}
