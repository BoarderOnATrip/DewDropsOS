export function swarmRunIsActive(status: string | undefined): boolean {
  return status === 'queued' || status === 'running' || status === 'staged'
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function formatRunStatus(status: string | undefined): string {
  if (!status) return 'unknown'
  return status.replace(/_/g, ' ')
}
