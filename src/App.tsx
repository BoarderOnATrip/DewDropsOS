import ErrorBoundary from './ErrorBoundary'
import BoardView from './freeform/BoardView'

export default function App() {
  return (
    <ErrorBoundary>
      <BoardView />
    </ErrorBoundary>
  )
}
