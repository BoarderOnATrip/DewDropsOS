import type { PresetEntry } from '../presets/index'

export type PresetPickerProps = {
  presets: readonly PresetEntry[]
  onSelect: (presetId: string) => void
  onDismiss: () => void
}

export function PresetPicker({ presets, onSelect, onDismiss }: PresetPickerProps) {
  return (
    <div
      className="freeform-toolbar-panel-wrap"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onDismiss()
      }}
    >
      <section className="freeform-toolbar-panel freeform-preset-picker" aria-label="Choose a workspace preset">
        <div className="freeform-toolbar-panel-header">
          <div>
            <h2>New workspace</h2>
            <p>Choose a preset to seed the workspace with rooms, briefs, and dependency wires.</p>
          </div>
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            onClick={onDismiss}
            aria-label="Cancel"
          >
            Cancel
          </button>
        </div>
        <div className="freeform-preset-picker-grid">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="freeform-preset-tile"
              onClick={() => onSelect(preset.id)}
            >
              <strong>{preset.name}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
