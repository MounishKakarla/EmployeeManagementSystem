import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { employeeAPI, attendanceAPI, leaveAPI } from '../api'
import useDocumentTitle from '../hooks/useDocumentTitle'
import {
  Users, UserX, Building2, ArrowRight, UserCheck, UserPlus,
  LogIn, LogOut, Timer, Umbrella, Heart, Coffee, TrendingUp,
  CalendarPlus, Clock, Badge
} from 'lucide-react'
import { formatDate } from '../utils/dateUtils'
import Skeleton from '../components/ui/Skeleton'
import { useUIStore } from '../store/uiStore'
import DashboardCharts from '../components/dashboard/DashboardCharts'
import '../styles/dashboard.css'

const DASHBOARD_QUOTES = [
  'Every great achievement begins with the decision to try.',
  'A positive attitude brings strength, energy, and initiative.',
  'Small steps every day lead to big results.',
  'Teamwork makes the dream work — and you are building it together.',
  'Success is the sum of small efforts repeated day in and day out.',
  'Today is a great day to move closer to your goals.',
  'Your work matters, and progress is being made.',
  'A fresh start every day is a powerful thing.',
  'Confidence comes from doing the thing you fear and taking action.',
  "Your effort today builds tomorrow's success.",
]

async function fetchQuoteFromApi() {
  const response = await fetch('https://api.quotable.io/random?tags=success|inspirational|motivational')
  if (!response.ok) throw new Error('Failed to fetch quote')
  return response.json()
}

function hashString(value) {
  return value.split('').reduce((hash, char) => {
    return ((hash << 5) - hash) + char.charCodeAt(0)
  }, 0)
}

function getUserQuote(user) {
  const seed = user?.empId || user?.name || 'guest'
  const index = Math.abs(hashString(seed)) % DASHBOARD_QUOTES.length
  return DASHBOARD_QUOTES[index]
}

function StatCard({ icon: Icon, value, label, color, bg, onClick }) {
  return (
    <div
      className="stat-card"
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="stat-icon" style={{ background: bg }}>
        <Icon size={18} color={color} />
      </div>
      <div className="stat-value">
        {value !== null
          ? value
          : <Skeleton height="28px" width="48px" style={{ display: 'inline-block', verticalAlign: 'middle' }} />
        }
      </div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

export default function DashboardPage() {
  const { user, isAdmin, isManager } = useAuth()
  const navigate = useNavigate()
  useDocumentTitle('Dashboard | Tektalis EMS')

  const { data: quoteData } = useQuery({
    queryKey: ['dashboardQuote'],
    queryFn: fetchQuoteFromApi,
    staleTime: 1000 * 60 * 60,
    cacheTime: 1000 * 60 * 60,
    retry: false,
  })

  const quote = quoteData?.content
    ? `${quoteData.content}${quoteData.author ? ` — ${quoteData.author}` : ''}`
    : getUserQuote(user)

  const { openEmployeeSheet, setNewEmployeeSheetOpen } = useUIStore()
  const canViewAll = isAdmin() || isManager()

  // ── Admin / Manager queries ─────────────────────────────────────────────
  const { data: activeData,   isLoading: isActiveLoading }   = useQuery({ queryKey: ['employees', 'active-summary'],  queryFn: () => employeeAPI.search({ page: 0, size: 5, sort: 'empId,desc' }), enabled: canViewAll })
  const { data: inactiveData, isLoading: isInactiveLoading } = useQuery({ queryKey: ['employees', 'inactive-count'],  queryFn: () => employeeAPI.getInactive({ page: 0, size: 1 }), enabled: canViewAll })
  const { data: allData,      isLoading: isAllLoading }      = useQuery({ queryKey: ['employees', 'dashboard-all'],   queryFn: () => employeeAPI.search({ page: 0, size: 2000 }), enabled: canViewAll })

  // ── Employee self-service queries (enabled for non-admin/manager) ──────────
  const { data: todayData }   = useQuery({ queryKey: ['attendance', 'today'], queryFn: () => attendanceAPI.getToday(), retry: 1, enabled: !canViewAll })
  const { data: balanceData } = useQuery({ queryKey: ['leave', 'balance'],    queryFn: () => leaveAPI.getMyBalance(), enabled: !canViewAll })

  const activeCount     = isActiveLoading   ? null : activeData?.data?.totalElements   ?? 0
  const inactiveCount   = isInactiveLoading ? null : inactiveData?.data?.totalElements ?? 0
  const totalCount      = (activeCount !== null && inactiveCount !== null) ? activeCount + inactiveCount : null
  const recentEmployees = activeData?.data?.content || []
  const allEmployees    = allData?.data?.content || []

  const deptMap = {}
  allEmployees.forEach(e => e.department?.split(',').forEach(d => {
    const t = d.trim()
    if (t) deptMap[t] = (deptMap[t] || 0) + 1
  }))
  const deptData = Object.entries(deptMap).map(([name, value]) => ({
    name: name.charAt(0) + name.slice(1).toLowerCase(),
    value,
  }))

  const hireMap = {}
  allEmployees.forEach(e => {
    if (e.dateOfJoin) {
      const d = new Date(e.dateOfJoin)
      const k = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`
      hireMap[k] = (hireMap[k] || 0) + 1
    }
  })
  const hireData = Object.entries(hireMap)
    .map(([name, hires]) => ({ name, hires }))
    .sort((a, b) => new Date(a.name) - new Date(b.name))
    .slice(-6)

  return (
    <div className="dashboard-page">

      {/* ── Greeting ──────────────────────────────────────────────────── */}
      <div className="dashboard-greeting">
        <h1>Good {getGreeting()}, {user?.name || user?.empId} 👋</h1>
        <p>{quote}</p>
      </div>

      {/* ── Stat Cards ────────────────────────────────────────────────── */}
      <div className="grid-4 dashboard-stats">
        {canViewAll ? (
          <>
            <StatCard
              icon={Users}
              value={activeCount}
              label="Active Employees"
              color="var(--accent)"
              bg="var(--accent-light)"
              onClick={() => navigate('/employees')}
            />
            {isAdmin() && (
              <StatCard
                icon={UserPlus}
                value="ADD"
                label="Add Employee"
                color="var(--success)"
                bg="var(--success-light)"
                onClick={() => setNewEmployeeSheetOpen(true)}
              />
            )}
            <StatCard
              icon={ArrowRight}
              value="BROWSE"
              label="Browse Employees"
              color="var(--info)"
              bg="var(--info-light)"
              onClick={() => navigate('/employees')}
            />
            <StatCard
              icon={UserCheck}
              value="VIEW"
              label="View My Profile"
              color="var(--accent)"
              bg="var(--accent-light)"
              onClick={() => navigate('/profile')}
            />
          </>
        ) : (
          <>
            <StatCard
              icon={Umbrella}
              value={balanceData?.data?.annualRemaining ?? '—'}
              label="Annual Leave Left"
              color="var(--info)"
              bg="var(--info-light)"
              onClick={() => navigate('/leave')}
            />
            <StatCard
              icon={LogIn}
              value={todayData?.data?.status
                ? todayData.data.status.replace(/_/g, ' ')
                : 'NOT IN'}
              label="Today's Status"
              color="var(--success)"
              bg="var(--success-light)"
              onClick={() => navigate('/attendance')}
            />
            <StatCard
              icon={UserCheck}
              value="VIEW"
              label="My Profile"
              color="var(--accent)"
              bg="var(--accent-light)"
              onClick={() => navigate('/profile')}
            />
            <StatCard
              icon={Timer}
              value="LOGS"
              label="My Timesheets"
              color="var(--warning)"
              bg="var(--warning-light)"
              onClick={() => navigate('/timesheets')}
            />
          </>
        )}
      </div>

      {/* ── Charts (admin / manager only) ─────────────────────────────── */}
      {canViewAll && (
        <DashboardCharts deptData={deptData} hireData={hireData} isLoading={isAllLoading} />
      )}

      {/* ── Bottom: Quick Actions (left) + Recent Employees (right) ───── */}
      <div className="dashboard-bottom">

        {/* ── Left: Quick Actions card ─────────────────────────────── */}
        <div className="dashboard-left-col">
          <div className="card qa-card">
            <h3 className="qa-title">Quick Actions</h3>

            {/* 2 × 2 icon button grid */}
            <div className="qa-icon-grid">
              <button className="qa-icon-btn" onClick={() => navigate('/attendance')}>
                <div className="qa-icon-wrap" style={{ background: 'var(--success-light)' }}>
                  <LogIn size={22} color="var(--success)" />
                </div>
                <span>Check In</span>
              </button>

              <button className="qa-icon-btn" onClick={() => navigate('/attendance')}>
                <div className="qa-icon-wrap" style={{ background: 'var(--danger-light)' }}>
                  <LogOut size={22} color="var(--danger)" />
                </div>
                <span>Check Out</span>
              </button>

              <button className="qa-icon-btn" onClick={() => navigate('/leave')}>
                <div className="qa-icon-wrap" style={{ background: 'var(--accent-light)' }}>
                  <CalendarPlus size={22} color="var(--accent)" />
                </div>
                <span>Request Leave</span>
              </button>

              <button className="qa-icon-btn" onClick={() => navigate('/timesheets')}>
                <div className="qa-icon-wrap" style={{ background: 'var(--info-light)' }}>
                  <Clock size={22} color="var(--info)" />
                </div>
                <span>Timesheets</span>
              </button>
            </div>

          </div>
        </div>

        {/* ── Right: Recent Employees ───────────────────────────────── */}
        {canViewAll && (
          <div className="card re-card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Card header */}
            <div className="re-header">
              <h3 className="card-title" style={{ margin: 0 }}>Recent Employees</h3>
              <button className="btn btn-ghost btn-sm re-view-all" onClick={() => navigate('/employees')}>
                View All <ArrowRight size={14} />
              </button>
            </div>

            {/* Table */}
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th className="desktop-only">Designation</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {isActiveLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <Skeleton height="36px" width="36px" borderRadius="50%" />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <Skeleton height="16px" width="120px" />
                                <Skeleton height="12px" width="160px" />
                              </div>
                            </div>
                          </td>
                          <td><Skeleton height="22px" width="80px" borderRadius="100px" /></td>
                          <td className="desktop-only"><Skeleton height="16px" width="100px" /></td>
                          <td><Skeleton height="16px" width="80px" /></td>
                        </tr>
                      ))
                    : recentEmployees.map(emp => (
                        <tr key={emp.empId} style={{ cursor: 'pointer' }} onClick={() => openEmployeeSheet(emp.empId)}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {emp.profileImage ? (
                                <img src={emp.profileImage} alt={emp.name} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--border)' }}/>
                              ) : (
                                <div className="avatar">
                                  {emp.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                                </div>
                              )}
                              <div>
                                <div style={{ fontWeight: 500 }}>{emp.name}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.companyEmail}</div>
                              </div>
                            </div>
                          </td>
                          <td><span className="badge badge-info">{emp.department}</span></td>
                          <td className="desktop-only" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{emp.designation}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{formatDate(emp.dateOfJoin)}</td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Employee-only welcome card (non-admin/manager) */}
        {!canViewAll && (
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', padding: '32px 24px' }}>
              <UserCheck size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
              <h3 style={{ marginBottom: 8 }}>Welcome to Tektalis EMS</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                Use the navigation bar to manage your attendance, leave and timesheets.
              </p>
            </div>
          </div>
        )}

      </div>


    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}