import type { BoardWire, WorkflowCard } from '../types'
import { crmPreset } from './crm'
import { diyMoviePreset } from './diyMovie'
import { stephanieCrmPreset } from './stephanieCrm'

export type BoardPreset = {
  cards: WorkflowCard[]
  wires: BoardWire[]
}

export type PresetEntry = {
  id: string
  name: string
  description: string
  workspaceName: string
  factory: () => BoardPreset
}

export const PRESET_REGISTRY: readonly PresetEntry[] = [
  {
    id: 'diy-movie',
    name: 'DIYMovie',
    description: 'Single-room movie-making workflow with idea, script, shotlist, edit, and publish approval gates.',
    workspaceName: 'DIYMovie workspace',
    factory: diyMoviePreset,
  },
  {
    id: 'crm',
    name: 'CRM',
    description: 'Contacts, Opportunities, Pipeline, and Follow-ups with dependency wires.',
    workspaceName: 'CRM workspace',
    factory: crmPreset,
  },
  {
    id: 'stephanie-crm',
    name: 'Stephanie CRM',
    description: 'Real estate CRM for Stephanie Mols — Contacts, Listings, Pipeline, Follow-ups.',
    workspaceName: 'Stephanie CRM',
    factory: stephanieCrmPreset,
  },
]

export function getPreset(id: string): PresetEntry | undefined {
  return PRESET_REGISTRY.find((entry) => entry.id === id)
}
