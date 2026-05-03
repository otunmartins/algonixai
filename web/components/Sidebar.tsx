'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

function IconHub() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}
function IconChat() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}
function IconResults() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}
function IconPolymer() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m9.9 9.9 2.1 2.1M4.9 19.1l2.1-2.1m9.9-9.9 2.1-2.1"/>
    </svg>
  )
}
function IconHistory() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}
function IconDossier() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )
}
function IconCorpus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  )
}
function IconSettings() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}
function IconMonitor() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}
function IconProfile() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

const NAV_MAIN = [
  { href: '/hub',            label: 'Hub',            Icon: IconHub },
  { href: '/chat',           label: 'Chat',           Icon: IconChat },
  { href: '/results',        label: 'Results',        Icon: IconResults },
  { href: '/polymer-studio', label: 'Polymer Studio', Icon: IconPolymer },
  { href: '/history',        label: 'History',        Icon: IconHistory },
  { href: '/dossier',        label: 'Dossier',        Icon: IconDossier },
  { href: '/corpus',         label: 'Corpus',         Icon: IconCorpus },
]

const NAV_BOTTOM = [
  { href: '/settings',   label: 'Settings',   Icon: IconSettings },
  { href: '/monitoring', label: 'Monitoring', Icon: IconMonitor },
  { href: '/profile',    label: 'Profile',    Icon: IconProfile },
]

export default function Sidebar() {
  const pathname = usePathname()

  function NavItem({ href, label, Icon }: { href: string; label: string; Icon: () => React.ReactElement }) {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link
        href={href}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '7px 16px',
          borderLeft: `2px solid ${active ? 'var(--teal)' : 'transparent'}`,
          background: active ? 'rgba(31,212,196,0.06)' : 'transparent',
          color: active ? 'var(--teal)' : 'var(--txt3)',
          fontFamily: 'var(--font-sans)',
          fontSize: '12px',
          fontWeight: 500,
          textDecoration: 'none',
          transition: 'background 0.12s, border-color 0.12s, color 0.12s',
          cursor: 'pointer',
        }}
        onMouseEnter={e => {
          if (!active) {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--txt)'
          }
        }}
        onMouseLeave={e => {
          if (!active) {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--txt3)'
          }
        }}
      >
        <span style={{ color: active ? 'var(--teal)' : 'var(--txt3)', flexShrink: 0 }}>
          <Icon />
        </span>
        {label}
      </Link>
    )
  }

  return (
    <aside style={{
      width: '240px',
      flexShrink: 0,
      background: 'var(--panel)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      height: '100vh',
    }}>

      {/* Logo */}
      <div style={{
        padding: '18px 16px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <div style={{
          width: 28, height: 28,
          borderRadius: 6,
          background: 'linear-gradient(135deg, var(--teal), var(--green))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 600,
          color: '#060f1c',
          letterSpacing: '-0.5px',
          flexShrink: 0,
        }}>
          Ax
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--txt)', letterSpacing: '1.5px' }}>
            ALGONIXAI
          </div>
          <div style={{ fontSize: 9, color: 'var(--txt3)', letterSpacing: '1px', marginTop: 1 }}>
            BIOLOGICS PLATFORM v1.0
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {NAV_MAIN.map(item => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)' }} />

      {/* Bottom nav */}
      <nav style={{ padding: '8px 0' }}>
        {NAV_BOTTOM.map(item => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 28, height: 28,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1a3a5c, #0f2a4a)',
          border: '1px solid var(--border2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, color: 'var(--teal)',
          flexShrink: 0,
        }}>
          DR
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)' }}>Dr. R. Patel</div>
          <div style={{ fontSize: 10, color: 'var(--txt3)' }}>Sr. Formulation Scientist</div>
        </div>
      </div>
    </aside>
  )
}
