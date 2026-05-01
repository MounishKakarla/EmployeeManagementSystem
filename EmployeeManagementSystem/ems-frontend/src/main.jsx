import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import ProtectedRoute from './components/auth/ProtectedRoute'
import RoleRoute from './components/auth/RoleRoute'
import AppLayout from './components/layout/AppLayout'
import { lazy } from 'react'
import ErrorBoundary from './components/ui/ErrorBoundary'
import './styles/index.css'

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

const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/login', element: <LoginPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/dashboard', element: <DashboardPage /> },
              { path: '/profile', element: <ProfilePage /> },
              { path: '/settings', element: <SettingsPage /> },
              { path: '/attendance', element: <AttendancePage /> },
              { path: '/leave', element: <LeavePage /> },
              { path: '/timesheets', element: <TimesheetPage /> },
              { path: '/holidays', element: <HolidayCalendarPage /> },
              {
                element: <RoleRoute roles={['ADMIN', 'MANAGER']} />,
                children: [{ path: '/employees', element: <EmployeesPage /> }],
              },
              {
                element: <RoleRoute roles={['ADMIN']} />,
                children: [{ path: '/audit', element: <AuditLogPage /> }],
              },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to='/' replace /> },
    ],
  },
], {
  future: { v7_relativeSplatPath: true },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 0,                  // Always refetch on mount / window focus
      refetchOnWindowFocus: true,    // Refresh when tab regains focus
      refetchOnMount: true,          // Refresh every time a page component mounts
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <RouterProvider router={router} fallbackElement={<PageLoader />} />
      </ErrorBoundary>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '10px',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            maxWidth: '480px',
            whiteSpace: 'pre-line',
            wordBreak: 'break-word',
          },
          success: { iconTheme: { primary: 'var(--success)', secondary: 'white' } },
          error:   { duration: 5000, iconTheme: { primary: 'var(--danger)', secondary: 'white' } },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
)
