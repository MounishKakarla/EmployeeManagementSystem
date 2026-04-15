// src/App.jsx
// Updated with all new feature routes: Attendance, Leave, Timesheets, Holidays, Audit Logs

import { Suspense, lazy } from 'react'
import { Outlet } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AttendancePage = lazy(() => import('./pages/AttendancePage'))
const LeavePage = lazy(() => import('./pages/LeavePage'))
const TimesheetPage = lazy(() => import('./pages/TimesheetPage'))
const HolidayCalendarPage = lazy(() => import('./pages/HolidayCalendarPage'))
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'))

function PageLoader() {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
      Loading page...
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </AuthProvider>
    </ThemeProvider>
  )
}
