export type CapabilityProfileOption = {
  value: string
  label: string
  detail?: string
  hint?: string
}

export type CapabilityProfilePickerProps = {
  label?: string
  value: string
  options: readonly CapabilityProfileOption[]
  onChange: (value: string) => void
  disabled?: boolean
  emptyLabel?: string
  description?: string
}

export function CapabilityProfilePicker({
  label = 'Capability profile',
  value,
  options,
  onChange,
  disabled = false,
  emptyLabel = 'Select a profile',
  description,
}: CapabilityProfilePickerProps) {
  const selected = options.find((option) => option.value === value)

  return (
    <section className="freeform-problem-inspector-section" aria-label={label}>
      <div className="freeform-toolbar-panel-problem">
        <div>
          <h3>{label}</h3>
          <p>{description ?? 'Choose the model, tools, and budget posture for this room.'}</p>
        </div>
      </div>
      <label className="freeform-field">
        <span>{label}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          <option value="">{emptyLabel}</option>
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
            <span>{selected.detail ?? selected.hint ?? 'Selected capability profile.'}</span>
          </div>
        </div>
      ) : (
        <p className="freeform-toolbar-panel-hint">{emptyLabel}</p>
      )}
    </section>
  )
}
