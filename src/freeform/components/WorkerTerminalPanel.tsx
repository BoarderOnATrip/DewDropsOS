import type { AgentRuntimeBinding, WorkflowCard } from '../types'
import type { DewDropHostStatus } from '../dewdropHosts'
import { DewDropTerminalCard } from './DewDropTerminalCard'

type WorkerTerminalPanelProps = {
  agents: readonly WorkflowCard[]
  onTitleChange?: (agentId: string, title: string) => void
  onRuntimeChange: (agentId: string, patch: Partial<AgentRuntimeBinding>) => void
  onStart: (agentId: string) => void
  onStop: (agentId: string) => void
  onRefresh: (agentId: string) => void
  onSendInput?: (agentId: string, input: string) => void
  onCheckHost?: (agentId: string, hostAlias: string) => void
  onRelayClipboard?: (agentId: string) => void
  onCopyShell?: (agentId: string, command: string) => void
  onCopyBootstrap?: (agentId: string, bootstrapText: string) => void
  hostStatusByAlias?: Record<string, DewDropHostStatus>
  busyAgentIds?: readonly string[]
}

export function WorkerTerminalPanel({
  agents,
  onTitleChange,
  onRuntimeChange,
  onStart,
  onStop,
  onRefresh,
  onSendInput,
  onCheckHost,
  onRelayClipboard,
  onCopyShell,
  onCopyBootstrap,
  hostStatusByAlias = {},
  busyAgentIds = [],
}: WorkerTerminalPanelProps) {
  if (agents.length === 0) {
    return (
      <section className="freeform-problem-inspector-section" aria-label="Worker terminals">
        <div className="freeform-toolbar-panel-problem">
          <div>
            <h3>Terminals</h3>
            <p>Assign DewDrops to the room and each one becomes a live terminal here.</p>
          </div>
        </div>
        <p className="freeform-toolbar-panel-hint">No assigned worker terminals yet.</p>
      </section>
    )
  }

  return (
    <section className="freeform-problem-inspector-section" aria-label="Worker terminals">
      <div className="freeform-toolbar-panel-problem">
        <div>
          <h3>Terminals</h3>
          <p>Each DewDrop is a terminal. Set the shell and root if needed, then type into it.</p>
        </div>
      </div>

      <div className="freeform-packet-list">
        {agents.map((agent) => {
          const busy = busyAgentIds.includes(agent.id)
          return (
            <DewDropTerminalCard
              key={agent.id}
              agent={agent}
              busy={busy}
              onTitleChange={onTitleChange}
              onRuntimeChange={onRuntimeChange}
              onStart={onStart}
              onStop={onStop}
              onRefresh={onRefresh}
              onSendInput={onSendInput}
              onCheckHost={onCheckHost}
              onRelayClipboard={onRelayClipboard}
              onCopyShell={onCopyShell}
              onCopyBootstrap={onCopyBootstrap}
              hostStatusOverride={
                agent.agentRuntime?.vpnAlias?.trim()
                  ? hostStatusByAlias[agent.agentRuntime.vpnAlias.trim()]
                  : undefined
              }
            />
          )
        })}
      </div>
    </section>
  )
}
