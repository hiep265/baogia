import { useEffect, useState } from 'react'

export default function App() {
  const [pong, setPong] = useState<string>('')

  useEffect(() => {
    window.api?.ping().then(setPong).catch(() => setPong(''))
  }, [])

  return (
    <div className="app">
      <h1>BaoGiaPro</h1>
      <p>Khung dự án Electron + React + Vite + TS</p>
      <p>Ping từ main: <strong>{pong || '...'}</strong></p>
    </div>
  )
}
