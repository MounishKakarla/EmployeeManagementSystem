// src/components/layout/AppLayout.jsx

import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard, Users, User, Settings, LogOut,
  Sun, Moon, BotMessageSquare, ChevronDown, Shield,
  Mail, Menu, X, Search,
  CalendarDays, Umbrella, Timer, CalendarCheck, ShieldAlert,
} from 'lucide-react'
import { useAuth }    from '../../context/AuthContext'
import { useTheme }   from '../../context/ThemeContext'
import { useUIStore } from '../../store/uiStore'
import ChatBotWidget        from '../ui/ChatBotWidget'
import EmployeeSideSheet    from '../ui/EmployeeSideSheet'
import CommandPalette       from '../ui/CommandPalette'
import NewEmployeeSheet     from '../ui/NewEmployeeSheet'
import SessionWarningModal  from '../ui/SessionWarningModal'
import logoWhite from '../../assets/Tektalis_Logo_White.svg'
import logoDark  from '../../assets/Tektalis_Logo_Dark.svg'
import toast     from 'react-hot-toast'

const NAV_ITEMS = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',  roles: null },
  { to: '/attendance', icon: CalendarDays,    label: 'Attendance', roles: null },
  { to: '/leave',      icon: Umbrella,        label: 'Leave',      roles: null },
  { to: '/timesheets', icon: Timer,           label: 'Timesheets', roles: null },
  { to: '/holidays',   icon: CalendarCheck,   label: 'Holidays',   roles: null },
  { to: '/employees',  icon: Users,           label: 'Employees',  roles: ['ADMIN', 'MANAGER'] },
  { to: '/audit',      icon: ShieldAlert,     label: 'Audit Logs', roles: ['ADMIN'] },
]

export default function AppLayout() {
  const { user, logout, isWarning, refreshSession } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate  = useNavigate()
  const location  = useLocation()

  const {
    isChatOpen, setChatOpen, chatWidth,
    paletteOpen, setPaletteOpen,
    activeEmpId, isInactiveView, closeEmployeeSheet,
    isNewEmployeeSheetOpen, setNewEmployeeSheetOpen,
    sideSheetWidth,
  } = useUIStore()

  const [avatarOpen, setAvatarOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const avatarRef = useRef(null)

  const sheetOpen = !!activeEmpId || isNewEmployeeSheetOpen
  const totalRightOffset = (isChatOpen ? chatWidth : 0) + (sheetOpen ? sideSheetWidth : 0)

  // Global Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(p => !p)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Close avatar dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target))
        setAvatarOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    await logout()
    toast.success('Signed out successfully')
    navigate('/login')
  }

  const filteredNav = NAV_ITEMS.filter(item => {
    if (!item.roles) return true
    return item.roles.some(r => user?.roles?.includes(r))
  })

  const handleChatAction = ({ action, entity }) => {
    const routes = {
      add: {
        employee:   '/employees',
        leave:      '/leave',
        attendance: '/attendance',
        holiday:    '/holidays',
        user:       '/employees',
      },
      update: {
        employee:   '/employees',
        leave:      '/leave',
        attendance: '/attendance',
        holiday:    '/holidays',
        user:       '/employees',
      },
      delete: {
        employee:   '/employees',
        leave:      '/leave',
        attendance: '/attendance',
        holiday:    '/holidays',
        user:       '/employees',
      },
    }

    if (action === 'add' && entity === 'employee') {
      setNewEmployeeSheetOpen(true)
      setChatOpen(false)
      return
    }

    const route = routes[action]?.[entity]
    if (route) {
      navigate(route)
      setChatOpen(false)
    }
  }

  const initials = user?.empId?.slice(0, 2).toUpperCase() || '??'
  const logoSrc  = theme === 'dark' ? logoWhite : logoDark

  return (
    <div className="app-layout-v2">

      {/* ── TOP NAVBAR ──────────────────────────────────────────────────────── */}
      <header className="topnav glass-panel">
        {/* Logo */}
        <div className="topnav-logo" onClick={() => navigate('/dashboard')} title="Dashboard">
          <img src={logoSrc} alt="Tektalis" />
        </div>

        {/* Desktop nav links — hidden via CSS at ≤900px, NO inline style */}
        <nav className="topnav-links">
          {filteredNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to} end={to === '/dashboard'}
              className={({ isActive }) => `topnav-item ${isActive ? 'active' : ''}`}
              title={label}
            >
              <Icon size={15} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Right controls */}
        <div className="topnav-right">
          {/* Search / Command Palette */}
          <button className="btn btn-ghost topnav-search-btn" onClick={() => setPaletteOpen(true)}>
            <Search size={15} />
            <span className="topnav-search-label">Search...</span>
            <kbd className="topnav-kbd">Ctrl K</kbd>
          </button>

          {/* Avatar dropdown */}
          <div ref={avatarRef} style={{ position: 'relative' }}>
            <button
              className="avatar-btn"
              onClick={() => setAvatarOpen(o => !o)}
              aria-label="User Account Menu"
              aria-expanded={avatarOpen}
            >
              <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials}</div>
              <ChevronDown size={13} style={{
                transition: 'transform 0.2s',
                color: 'var(--text-muted)',
                transform: avatarOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }} />
            </button>

            {avatarOpen && (
              <div className="avatar-dropdown glass-panel">
                <div className="avatar-dropdown-header">
                  <div className="avatar" style={{ width: 44, height: 44, fontSize: 16, flexShrink: 0 }}>{initials}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{user?.name || user?.empId}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user?.companyEmail}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {user?.roles?.map(r => (
                        <span key={r} className={`badge role-${r.toLowerCase()}`} style={{ fontSize: 10, padding: '1px 6px' }}>{r}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="avatar-dropdown-divider" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <DropdownItem
                    icon={theme === 'dark' ? Sun : Moon}
                    label={`Theme: ${theme === 'dark' ? 'Light' : 'Dark'}`}
                    onClick={toggleTheme}
                  />
                  <DropdownItem icon={User}     label="My Profile" onClick={() => { navigate('/profile');  setAvatarOpen(false) }} />
                  <DropdownItem icon={Settings} label="Settings"   onClick={() => { navigate('/settings'); setAvatarOpen(false) }} />
                  <DropdownItem icon={Shield}   label={`ID: ${user?.empId}`} onClick={() => {}} muted />
                  <DropdownItem icon={Mail}     label={user?.companyEmail}   onClick={() => {}} muted small />
                </div>
                <div className="avatar-dropdown-divider" />
                <DropdownItem icon={LogOut} label="Sign Out" onClick={handleLogout} danger />
              </div>
            )}
          </div>

          {/* Hamburger — CSS hides this on desktop (>900px), shows on mobile only */}
          <button
            className="btn-icon topnav-hamburger"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle Mobile Menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </header>

      {/* ── MOBILE NAV DRAWER ─────────────────────────────────────────────────
          Only rendered in the DOM when mobileOpen is true.
          CSS also ensures it can never show on desktop. ── */}
      {mobileOpen && (
        <>
          <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
          <nav className="mobile-nav glass-panel">
            {filteredNav.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to} to={to} end={to === '/dashboard'}
                className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={16} /> {label}
              </NavLink>
            ))}
          </nav>
        </>
      )}

      {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <main
        className="main-v2"
        aria-hidden={paletteOpen ? 'true' : undefined}
        style={{
          width: `calc(100% - ${totalRightOffset}px)`,
          marginRight: totalRightOffset,
          transition: 'all 0.3s ease',
          overflowX: 'auto',
          minWidth: 0,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="page-v2"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── FLOATING CHAT BUTTON ────────────────────────────────────────────── */}
      {!isChatOpen && (user?.roles?.includes('ADMIN') || user?.roles?.includes('MANAGER')) && (
        <div
          className="floating-chat-btn"
          onClick={() => setChatOpen(true)}
          aria-label="Open Aura AI Chatbot"
          style={{
            right: sheetOpen ? `calc(${sideSheetWidth}px + 20px)` : '20px',
            transition: 'right 0.3s ease',
          }}
        >
          <BotMessageSquare />
        </div>
      )}

      {/* ── SIDE PANELS ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isChatOpen && <ChatBotWidget onClose={() => setChatOpen(false)} onAction={handleChatAction} />}
        {activeEmpId && (
          <EmployeeSideSheet
            empId={activeEmpId}
            isInactiveView={isInactiveView}
            onClose={closeEmployeeSheet}
          />
        )}
        {isNewEmployeeSheetOpen && (
          <NewEmployeeSheet onClose={() => setNewEmployeeSheetOpen(false)} />
        )}
      </AnimatePresence>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <SessionWarningModal isOpen={isWarning} onStay={refreshSession} onLogout={handleLogout} />
    </div>
  )
}

function DropdownItem({ icon: Icon, label, onClick, danger, muted, small }) {
  return (
    <button
      onClick={onClick}
      className="dropdown-item"
      style={{
        color: danger ? 'var(--danger)' : muted ? 'var(--text-muted)' : 'var(--text-secondary)',
        fontSize: small ? 11 : 13,
      }}
    >
      <Icon size={13} style={{ flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}