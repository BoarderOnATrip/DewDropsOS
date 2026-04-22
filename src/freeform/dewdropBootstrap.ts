import {
  defaultCommandForRuntimeProfile,
  defaultModelTagForRuntimeProfile,
  pickerRuntimeProfile,
  runtimeProfileLabel,
} from './agentRuntime'
import type { AgentRuntimeBinding } from './types'

export type DewDropBootstrapPlan = {
  title: string
  summary: string
  routeLabel: string
  commands: string[]
  notes: string[]
}

function normalizedCommand(runtime: AgentRuntimeBinding): string {
  return (
    runtime.command?.trim() ||
    defaultCommandForRuntimeProfile(runtime.profile, { modelTag: runtime.modelTag }) ||
    'zsh -i -f'
  )
}

export function dewDropRouteLabel(runtime: AgentRuntimeBinding | undefined): string {
  const hostAlias = runtime?.vpnAlias?.trim()
  return hostAlias ? `vpn-ssh via ${hostAlias}` : 'local'
}

export function buildDewDropBootstrapPlan(
  runtime: AgentRuntimeBinding | undefined,
): DewDropBootstrapPlan | null {
  if (!runtime) return null
  const profile = pickerRuntimeProfile(runtime.profile)
  const hostAlias = runtime.vpnAlias?.trim()
  const workspaceRoot = runtime.workspaceRoot?.trim() || '.'
  const routeLabel = dewDropRouteLabel(runtime)
  const modelTag =
    runtime.modelTag?.trim() ||
    (profile === 'ollama' ? defaultModelTagForRuntimeProfile('ollama') : undefined)

  if (profile === 'hermes') {
    return {
      title: 'Hermes node bootstrap',
      summary: `Prepare a ${runtimeProfileLabel(profile)} worker on ${routeLabel}.`,
      routeLabel,
      commands: [
        'curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash',
        'source ~/.bashrc',
        `mkdir -p ${workspaceRoot}`,
        'hermes setup',
        normalizedCommand(runtime),
      ],
      notes: [
        hostAlias
          ? `Run these on ${hostAlias} first, then start the DewDrop from DewDrops.`
          : 'Run these on the local machine first, then start the DewDrop from DewDrops.',
        'Use non-interactive env-based config later for fleet nodes; `hermes setup` is fine for the first machine.',
      ],
    }
  }

  if (profile === 'ollama') {
    return {
      title: 'Local model node bootstrap',
      summary: `Prepare an Ollama-backed local model worker${modelTag ? ` for ${modelTag}` : ''} on ${routeLabel}.`,
      routeLabel,
      commands: [
        '# macOS: brew install ollama',
        '# Linux: curl -fsSL https://ollama.com/install.sh | sh',
        '# if Ollama is not already serving: OLLAMA_HOST=127.0.0.1:11434 ollama serve',
        `ollama pull ${modelTag ?? 'qwen2.5-coder:7b'}`,
        `mkdir -p ${workspaceRoot}`,
        normalizedCommand(runtime),
      ],
      notes: [
        'Keep the Host field blank to run the model on this machine, or bind it to `gpu-01` / `builder-01` for remote inference.',
        `Model selection is structured now: this DewDrop is pinned to \`${modelTag ?? 'qwen2.5-coder:7b'}\`, and the shell stays in sync until you customize it.`,
        hostAlias
          ? `Run these on ${hostAlias} if this DewDrop should execute local inference over VPN SSH.`
          : 'Run these locally if this DewDrop should execute local inference on the current machine.',
      ],
    }
  }

  if (profile === 'browser-harness') {
    return {
      title: 'Browser worker bootstrap',
      summary: `Prepare a Browser Harness worker on ${routeLabel}.`,
      routeLabel,
      commands: [
        'curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash',
        'source ~/.bashrc',
        'curl -LsSf https://astral.sh/uv/install.sh | sh',
        'source ~/.local/bin/env',
        `mkdir -p ${workspaceRoot} && cd ${workspaceRoot}`,
        'git clone https://github.com/browser-use/browser-harness',
        'cd browser-harness',
        'uv tool install -e .',
        'mkdir -p ~/.hermes/skills/browser-harness',
        'ln -sf browser-harness/SKILL.md ~/.hermes/skills/browser-harness/SKILL.md',
        normalizedCommand(runtime),
      ],
      notes: [
        'Set `BROWSER_USE_API_KEY` on the host if you want Browser Use cloud sessions through Hermes.',
        hostAlias
          ? `Run these on ${hostAlias}, then route the DewDrop there over VPN SSH.`
          : 'Run these locally if the browser worker should stay on this machine.',
      ],
    }
  }

  if (profile === 'browser-harness-js') {
    return {
      title: 'Browser JS worker bootstrap',
      summary: `Prepare a Browser Harness JS worker on ${routeLabel}.`,
      routeLabel,
      commands: [
        `mkdir -p ${workspaceRoot} && cd ${workspaceRoot}`,
        'git clone https://github.com/browser-use/browser-harness-js',
        'cd browser-harness-js',
        'npm install',
        normalizedCommand(runtime),
      ],
      notes: [
        'Use this when you want the thinnest JS/CDP browser worker instead of the Python harness.',
      ],
    }
  }

  if (profile === 'playwright') {
    return {
      title: 'Playwright node bootstrap',
      summary: `Prepare a Playwright worker on ${routeLabel}.`,
      routeLabel,
      commands: [
        `mkdir -p ${workspaceRoot} && cd ${workspaceRoot}`,
        'npm install -D @playwright/test',
        'PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers npx playwright install --with-deps chromium',
        normalizedCommand(runtime),
      ],
      notes: [
        'If the repo does not have Playwright wired yet, `npm init playwright@latest` is the quickest scaffold.',
        'Use `PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers` on shared hosts so browser binaries are reused across DewDrops.',
        hostAlias
          ? `Run these on ${hostAlias} if this DewDrop should execute Playwright over VPN SSH.`
          : 'Run these locally if this DewDrop should execute Playwright on the current machine.',
      ],
    }
  }

  return null
}
