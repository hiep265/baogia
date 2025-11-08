import { useEffect, useState } from 'react'
import WorkbookView from './pages/WorkbookView'

export default function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => { window.api?.ping().finally(() => setReady(true)) }, [])
  if (!ready) return null
  return <WorkbookView />
}
