/** `pointerdown`/`mousedown` target is often a Text node — it has no `.closest`. */
export function pointerEventTargetEl(e: { target: EventTarget | null }): Element | null {
  const n = e.target
  if (n instanceof Element) return n
  if (n instanceof Text) return n.parentElement
  return null
}

export function eventPathHitsBoardCard(path: EventTarget[] | undefined): boolean {
  if (!path) return false
  return path.some(
    (node) =>
      node instanceof Element &&
      (node.classList.contains('freeform-card') || node.hasAttribute('data-board-card')),
  )
}
