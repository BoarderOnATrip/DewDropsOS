export type SwarmRecipeOption = {
  value: string
  label: string
  detail?: string
  template?: string
}

export type SwarmRecipePickerProps = {
  label?: string
  value: string
  options: readonly SwarmRecipeOption[]
  onChange: (value: string) => void
  disabled?: boolean
  emptyLabel?: string
  description?: string
}

export function SwarmRecipePicker({
  label = 'Swarm recipe',
  value,
  options,
  onChange,
  disabled = false,
  emptyLabel = 'Select a recipe',
  description,
}: SwarmRecipePickerProps) {
  const selected = options.find((option) => option.value === value)

  return (
    <section className="freeform-problem-inspector-section" aria-label={label}>
      <div className="freeform-toolbar-panel-problem">
        <div>
          <h3>{label}</h3>
          <p>{description ?? 'Choose the team composition and role sequence for this launch.'}</p>
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
            <span>{selected.detail ?? selected.template ?? 'Selected swarm recipe.'}</span>
          </div>
        </div>
      ) : (
        <p className="freeform-toolbar-panel-hint">{emptyLabel}</p>
      )}
    </section>
  )
}
