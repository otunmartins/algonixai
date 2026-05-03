import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar />
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        {children}
      </div>
    </div>
  )
}
