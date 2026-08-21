import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { initials } from '../lib/format'
import { isDistributorSide, useAuthStore } from '../store/auth'
import { useCartStore } from '../store/cart'
import { useNotificationStore } from '../store/notifications'
import { useActiveOrderStore } from '../store/orders'
import { useUIStore } from '../store/ui'
import { Icon } from './Icons'
import { Button } from './ui'

export function Header() {
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuthStore()
  const cartCount = useCartStore((state) => state.cartItems.reduce((sum, line) => sum + line.quantity, 0))
  const unread = useNotificationStore((state) => state.unreadCount)
  const activeOrders = useActiveOrderStore((state) => state.activeOrders)
  const { theme, toggleTheme, openAuth, setNotificationsOpen } = useUIStore()

  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [bump, setBump] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const previousCount = useRef(cartCount)

  useEffect(() => {
    if (cartCount > previousCount.current) {
      setBump(true)
      const timer = setTimeout(() => setBump(false), 500)
      return () => clearTimeout(timer)
    }
    previousCount.current = cartCount
  }, [cartCount])

  useEffect(() => {
    previousCount.current = cartCount
  }, [cartCount])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const workspaceLink = user?.role === 'admin' ? '/admin' : '/distributor'
  const links = [
    { to: '/', label: 'Home', end: true },
    { to: '/orders', label: 'My orders' },
    { to: '/help', label: 'Help' },
  ]

  const signOut = () => {
    logout()
    setMenuOpen(false)
    navigate('/')
  }

  return (
    <>
      <header className="site-header">
        <div className="shell">
          <Link to="/" className="brand" aria-label="Hotel Express home">
            <span className="brand-mark">
              <Icon name="utensils" size={19} />
            </span>
            Hotel<span style={{ color: 'var(--brand-primary)' }}>Express</span>
          </Link>

          <nav className="main-nav" aria-label="Primary">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                {link.label}
              </NavLink>
            ))}
            {isAuthenticated && activeOrders.length ? (
              <NavLink to={`/orders/track/${activeOrders[0].order_id}`} className="nav-link">
                Active orders
                <span className="badge badge-brand" style={{ marginLeft: 6 }}>{activeOrders.length}</span>
              </NavLink>
            ) : null}
            {isAuthenticated && isDistributorSide(user?.role) ? (
              <NavLink to="/distributor" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Workspace
              </NavLink>
            ) : null}
            {user?.role === 'admin' ? (
              <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Admin
              </NavLink>
            ) : null}
          </nav>

          <div className="header-actions">
            <button className="icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            </button>

            <Link to="/checkout" className="icon-btn" aria-label={`Cart, ${cartCount} items`}>
              <Icon name="cart" size={18} />
              {cartCount > 0 ? <span className={`count-badge ${bump ? 'bump' : ''}`}>{cartCount}</span> : null}
            </Link>

            {isAuthenticated ? (
              <button className="icon-btn" onClick={() => setNotificationsOpen(true)} aria-label={`Notifications, ${unread} unread`}>
                <Icon name="bell" size={18} />
                {unread > 0 ? <span className="count-badge">{unread}</span> : null}
              </button>
            ) : null}

            {isAuthenticated ? (
              <div ref={menuRef} style={{ position: 'relative' }}>
                <button className="avatar-btn" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-haspopup="menu">
                  <span className="avatar">{initials(user?.name ?? '')}</span>
                  <span className="small strong nowrap" style={{ maxWidth: 110 }}>
                    {user?.name?.split(' ')[0]}
                  </span>
                  <Icon name="chevronDown" size={14} />
                </button>
                {menuOpen ? (
                  <div className="menu-pop" role="menu">
                    <div style={{ padding: '0.35rem 0.7rem 0.6rem' }}>
                      <strong className="small">{user?.name}</strong>
                      <p className="tiny muted truncate">{user?.email}</p>
                      <span className="badge badge-brand tiny" style={{ marginTop: 6 }}>{user?.role}</span>
                    </div>
                    <hr />
                    <Link to="/profile" onClick={() => setMenuOpen(false)}>
                      <Icon name="user" size={15} /> Profile & addresses
                    </Link>
                    <Link to="/orders" onClick={() => setMenuOpen(false)}>
                      <Icon name="package" size={15} /> Order history
                    </Link>
                    {isDistributorSide(user?.role) || user?.role === 'admin' ? (
                      <Link to={workspaceLink} onClick={() => setMenuOpen(false)}>
                        <Icon name="dashboard" size={15} /> {user?.role === 'admin' ? 'Admin console' : 'Distributor workspace'}
                      </Link>
                    ) : null}
                    <Link to="/help" onClick={() => setMenuOpen(false)}>
                      <Icon name="help" size={15} /> Help & support
                    </Link>
                    <hr />
                    <button onClick={signOut}>
                      <Icon name="logout" size={15} /> Log out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="tip" onClick={() => openAuth('signin')}>
                  Log in
                </Button>
                <Button variant="primary" size="sm" onClick={() => openAuth('signup')}>
                  Sign up
                </Button>
              </>
            )}

            <button className="icon-btn mobile-toggle" onClick={() => setMobileOpen((open) => !open)} aria-label="Toggle navigation" aria-expanded={mobileOpen}>
              <Icon name={mobileOpen ? 'close' : 'menu'} size={18} />
            </button>
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <div className="mobile-nav">
          <div className="shell">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
            {isDistributorSide(user?.role) ? (
              <NavLink to="/distributor" className="nav-link" onClick={() => setMobileOpen(false)}>
                Distributor workspace
              </NavLink>
            ) : null}
            {user?.role === 'admin' ? (
              <NavLink to="/admin" className="nav-link" onClick={() => setMobileOpen(false)}>
                Admin console
              </NavLink>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
