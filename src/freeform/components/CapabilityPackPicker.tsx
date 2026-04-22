export type CapabilityPackOption = {
  value: string
  label: string
  detail?: string
  summary?: string
}

export type CapabilityPackPickerProps = {
  value: string
  options: readonly CapabilityPackOption[]
  onChange: (value: string) => void
  disabled?: boolean
}

export function CapabilityPackPicker({
  value,
  options,
  onChange,
  disabled = false,
}: CapabilityPackPickerProps) {
  const selected = options.find((option) => option.value === value)

  return (
    <section className="freeform-problem-inspector-section" aria-label="Capability pack">
      <div className="freeform-toolbar-panel-problem">
        <div>
          <h3>Capability pack</h3>
          <p>Apply a reusable launch bundle instead of setting profile, recipe, and defaults separately.</p>
        </div>
      </div>
      <label className="freeform-field">
        <span>Capability pack</span>
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          <option value="">Compose manually</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <div className="freeform-mode-chip-row">
          <div className="freeform-mode-chip">
            <strong>{selected.label}</strong>
            <span>{selected.summary ?? selected.detail ?? 'Selected capability pack.'}</span>
          </div>
        </div>
      ) : (
        <p className="freeform-toolbar-panel-hint">
          Manual mode. Choose a capability profile and swarm recipe independently.
        </p>
      )}
    </section>
  )
}
