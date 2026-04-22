import { useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import type { BriefCompartmentOption } from '../briefCompartments'
import type { BriefCompartmentAsset } from '../types'

type BriefCompartmentIntakePanelProps = {
  assets: readonly BriefCompartmentAsset[]
  compartmentOptions: readonly BriefCompartmentOption[]
  disabled?: boolean
  onAddFiles: (files: File[]) => void
  onCompartmentChange: (assetId: string, compartmentId: string) => void
  onRemove: (assetId: string) => void
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes <= 0) return '0 B'
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  if (sizeBytes < 1024 * 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatAddedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function BriefCompartmentIntakePanel({
  assets,
  compartmentOptions,
  disabled = false,
  onAddFiles,
  onCompartmentChange,
  onRemove,
}: BriefCompartmentIntakePanelProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const groupedAssets = assets.reduce<Record<string, BriefCompartmentAsset[]>>((groups, asset) => {
    const key = asset.compartmentId || asset.compartmentLabel
    groups[key] = [...(groups[key] ?? []), asset]
    return groups
  }, {})

  const handleFiles = (files: FileList | null) => {
    const nextFiles = Array.from(files ?? [])
    if (nextFiles.length === 0 || disabled) return
    onAddFiles(nextFiles)
  }

  const openPicker = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files)
    event.target.value = ''
  }

  const onDropFiles = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    handleFiles(event.dataTransfer.files)
  }

  return (
    <section className="freeform-problem-inspector-section" aria-label="Briefcase compartments">
      <div className="freeform-toolbar-panel-problem">
        <div>
          <h3>Briefcase compartments</h3>
          <p>Load source material into the briefcase. DewDrops sorts it against the brief and the current loci.</p>
        </div>
        <span className="freeform-run-pill">{assets.length} assets</span>
      </div>

      <div
        className={`freeform-room-compartment-dropzone${dragActive ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragActive(true)
        }}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!disabled) setDragActive(true)
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
          setDragActive(false)
        }}
        onDrop={onDropFiles}
      >
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          multiple
          onChange={onInputChange}
          style={{ display: 'none' }}
        />
        <strong>Set the brief, then load the compartments</strong>
        <p>The clearer the brief is, the tighter the sorting becomes and the cleaner the build loop stays.</p>
        <div className="freeform-toolbar-panel-actions">
          <button type="button" className="freeform-btn freeform-btn--tool" onClick={openPicker} disabled={disabled}>
            Choose files
          </button>
          <span className="freeform-toolbar-panel-hint">PDFs, docs, sheets, media, notes, exports.</span>
        </div>
      </div>

      {assets.length > 0 ? (
        <div className="freeform-room-compartment-stack" aria-label="Organized briefcase materials">
          {Object.entries(groupedAssets).map(([groupId, groupAssets]) => {
            const option = compartmentOptions.find((entry) => entry.id === groupId)
            const groupLabel = option?.label ?? groupAssets[0]?.compartmentLabel ?? 'Compartment'
            return (
              <section key={groupId} className="freeform-room-compartment-group">
                <div className="freeform-toolbar-panel-problem">
                  <div>
                    <h3>{groupLabel}</h3>
                    <p>{groupAssets.length} indexed material{groupAssets.length === 1 ? '' : 's'}</p>
                  </div>
                  <span className="freeform-session-pill">{groupAssets[0]?.compartmentKind.replace(/_/g, ' ')}</span>
                </div>
                <div className="freeform-room-compartment-asset-grid">
                  {groupAssets.map((asset) => (
                    <article key={asset.id} className={`freeform-room-compartment-asset is-${asset.organizeStatus}`}>
                      <div className="freeform-room-compartment-asset-head">
                        <strong>{asset.name}</strong>
                        <span className={`freeform-session-pill is-${asset.organizeStatus === 'sorted' ? 'ready' : 'attention'}`}>
                          {asset.organizeStatus === 'sorted' ? 'Sorted' : 'Review'}
                        </span>
                      </div>
                      <p>{asset.organizeReason ?? `Stored in ${asset.compartmentLabel}.`}</p>
                      <div className="freeform-room-compartment-meta">
                        <span>{formatBytes(asset.sizeBytes)}</span>
                        <span>{asset.extension ? `.${asset.extension}` : asset.mimeType}</span>
                        <span>{formatAddedAt(asset.addedAt)}</span>
                      </div>
                      <div className="freeform-problem-inspector-grid">
                        <label className="freeform-field">
                          <span>Compartment</span>
                          <select
                            value={asset.compartmentId}
                            onChange={(event) => onCompartmentChange(asset.id, event.target.value)}
                            disabled={disabled}
                          >
                            {compartmentOptions.map((optionEntry) => (
                              <option key={optionEntry.id} value={optionEntry.id}>
                                {optionEntry.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="freeform-field">
                          <span>Anchor ref</span>
                          <input type="text" value={asset.anchorRef} readOnly />
                        </label>
                      </div>
                      <div className="freeform-toolbar-panel-actions">
                        <button
                          type="button"
                          className="freeform-btn freeform-btn--tool"
                          onClick={() => onRemove(asset.id)}
                          disabled={disabled}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <p className="freeform-toolbar-panel-hint">
          No intake materials indexed yet. Add files here so the briefcase can keep context, source material, and delivery assets organized.
        </p>
      )}
    </section>
  )
}
