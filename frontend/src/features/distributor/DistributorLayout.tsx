import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { Icon, type IconName } from '../../components/Icons'
import { Alert, Badge, Card, Toggle } from '../../components/ui'
import { errorMessage } from '../../services/errors'
import { canAccess, useAuthStore } from '../../store/auth'
import { useDistributorStore } from '../../store/distributor'
import { useUIStore } from '../../store/ui'

const NAV: { to: string; label: string; icon: IconName; section: string; end?: boolean }[] = [
  { to: '/distributor', label: 'Dashboard', icon: 'dashboard', section: 'dashboard', end: true },
  { to: '/distributor/profile', label: 'Hotel profile', icon: 'store', section: 'profile' },
  { to: '/distributor/menu', label: 'Menu manager', icon: 'utensils', section: 'menu' },
  { to: '/distributor/delivery', label: 'Delivery setup', icon: 'truck', section: 'delivery' },
  { to: '/distributor/orders', label: 'Orders queue', icon: 'list', section: 'orders' },
  { to: '/distributor/reports', label: 'Reports', icon: 'chart', section: 'reports' },
  { to: '/distributor/staff', label: 'Staff accounts', icon: 'users', section: 'staff' },
]

export function DistributorLayout() {
  const { user } = useAuthStore()
  const { hotel, fetchHotel, toggleOnlineStatus } = useDistributorStore()
  const toast = useUIStore((state) => state.toast)

  useEffect(() => {
    void fetchHotel()
  }, [fetchHotel])

  const flip = async () => {
    try {
      const online = await toggleOnlineStatus()
      toast(online ? 'success' : 'warning', online ? 'Hotel is now online' : 'Hotel is now offline', online ? 'Customers can place orders again.' : 'New orders are paused for customers.')
    } catch (error) {
      toast('error', 'Could not change status', errorMessage(error))
    }
  }

  return (
    <div className="shell workspace">
      <nav className="side-nav" aria-label="Distributor workspace">
        <div className="stack" style={{ padding: 'var(--space-3)', gap: 4 }}>
          <strong className="small truncate">{hotel?.name ?? 'Your workspace'}</strong>
          <span className="tiny muted truncate">{user?.name} · {user?.role}</span>
        </div>
        {NAV.map((entry) => {
          const allowed = canAccess(user?.role, entry.section)
          return (
            <NavLink
              key={entry.to}
              to={entry.to}
              end={entry.end}
              className={({ isActive }) => `side-link ${isActive ? 'active' : ''} ${allowed ? '' : 'disabled'}`}
              aria-disabled={!allowed}
              tabIndex={allowed ? undefined : -1}
              title={allowed ? undefined : 'Outside your role scope'}
            >
              <Icon name={entry.icon} size={16} />
              {entry.label}
              {!allowed ? <Icon name="shield" size={13} /> : null}
            </NavLink>
          )
        })}
      </nav>

      <div className="stack" style={{ gap: 'var(--space-5)' }}>
        <Card className="row-between wrap" style={{ gap: 'var(--space-3)' }}>
          <div>
            <h2>{hotel?.name ?? 'Distributor workspace'}</h2>
            <span className="tiny muted">{hotel?.place || 'Set your address in Hotel profile'}</span>
          </div>
          <div className="row wrap" style={{ gap: 'var(--space-3)' }}>
            {hotel ? (
              <Badge tone={hotel.is_verified ? 'badge-open' : 'badge-warning'} icon={hotel.is_verified ? 'checkCircle' : 'clock'}>
                {hotel.is_verified ? 'Verified' : 'Pending verification'}
              </Badge>
            ) : null}
            <Toggle
              checked={Boolean(hotel?.is_online)}
              onChange={() => void flip()}
              label={hotel?.is_online ? 'Online — accepting orders' : 'Offline'}
              disabled={!hotel}
            />
          </div>
        </Card>

        {hotel && !hotel.is_verified ? (
          <Alert tone="warning" icon="shield">
            <strong>Your listing is awaiting admin verification</strong>
            Customers cannot see this hotel on the home feed yet. You can keep configuring your menu and logistics in the meantime.
          </Alert>
        ) : null}

        <Outlet />
      </div>
    </div>
  )
}
