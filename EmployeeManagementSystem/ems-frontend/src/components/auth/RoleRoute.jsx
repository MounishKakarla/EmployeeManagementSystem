// src/components/auth/RoleRoute.jsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function RoleRoute({ roles }) {
  const { user } = useAuth()
  const allowed  = roles.some(r => user?.roles?.includes(r))
  if (!allowed) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
