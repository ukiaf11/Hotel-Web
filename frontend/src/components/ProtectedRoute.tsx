import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { canAccess, useAuthStore } from '../store/auth'
import { useUIStore } from '../store/ui'
import { Alert } from './ui'

interface Props {
  children: ReactNode
  roles?: string[]
  section?: string
}

export function ProtectedRoute({ children, roles, section }: Props) {
  const { isAuthenticated, user } = useAuthStore()
  const openAuth = useUIStore((state) => state.openAuth)
  const location = useLocation()

  useEffect(() => {
    if (!isAuthenticated) openAuth('signin')
  }, [isAuthenticated, openAuth])

  if (!isAuthenticated) return <Navigate to="/" replace state={{ from: location.pathname }} />

  if (roles && user && !roles.includes(user.role)) {
    return (
      <div className="shell section">
        <Alert tone="danger" icon="shield">
          <strong>403 — Access denied</strong>
          Your account role ({user.role}) does not have permission to open this workspace.
        </Alert>
      </div>
    )
  }

  if (section && user && !canAccess(user.role, section)) {
    return (
      <div className="shell section">
        <Alert tone="warning" icon="shield">
          <strong>403 — Access denied</strong>
          The “{section}” panel is outside your role’s scope. Ask a manager for access.
        </Alert>
      </div>
    )
  }

  return <>{children}</>
}
