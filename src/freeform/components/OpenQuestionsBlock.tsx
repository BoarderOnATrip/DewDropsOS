type OpenQuestionsBlockProps = { items: string[] }

export function OpenQuestionsBlock({ items }: OpenQuestionsBlockProps) {
  if (items.length === 0) return null
  return (
    <div className="freeform-open-questions" role="status" aria-live="polite">
      <div className="freeform-open-questions-title">Open questions — check and steer</div>
      <ul className="freeform-open-questions-list">
        {items.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ul>
    </div>
  )
}
