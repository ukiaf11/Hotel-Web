import { Link } from 'react-router-dom'

import { IS_DEMO, setToken } from '../services/api'
import { resetDb } from '../services/demo/db'
import { useUIStore } from '../store/ui'
import { Icon } from './Icons'

export function Footer() {
  const { openAuth, askConfirm } = useUIStore()

  const resetDemo = () =>
    askConfirm({
      title: 'Reset the demo data?',
      body: 'Every hotel, menu, order and account returns to the original seeded state, and you are signed out.',
      confirmLabel: 'Reset demo',
      danger: true,
      onConfirm: () => {
        resetDb()
        setToken(null)
        localStorage.removeItem('hotelweb.user')
        localStorage.removeItem('hotelweb.cart')
        window.location.href = '/'
      },
    })

  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-grid">
          <div>
            <div className="brand" style={{ marginBottom: 'var(--space-3)' }}>
              <span className="brand-mark">
                <Icon name="utensils" size={19} />
              </span>
              Hotel<span style={{ color: 'var(--brand-primary)' }}>Express</span>
            </div>
            <p className="small muted" style={{ maxWidth: '38ch' }}>
              Discover neighbourhood hotels, schedule meals around your day, and pay offline at
              delivery or the counter.
            </p>
            {IS_DEMO ? (
              <div className="stack" style={{ marginTop: 'var(--space-3)', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                <p className="tiny muted">
                  Running in demo mode — every hotel, order and account lives in your browser, so you can
                  change anything safely.
                </p>
                <button className="btn btn-ghost btn-sm" onClick={resetDemo}>
                  <Icon name="refresh" size={13} /> Reset demo data
                </button>
              </div>
            ) : null}
          </div>

          <div>
            <h5>Platform</h5>
            <ul>
              <li><Link to="/">Browse hotels</Link></li>
              <li><Link to="/orders">Order history</Link></li>
              <li><Link to="/profile">Your profile</Link></li>
              <li><Link to="/checkout">Cart & checkout</Link></li>
            </ul>
          </div>

          <div>
            <h5>Support</h5>
            <ul>
              <li><Link to="/help">Help centre</Link></li>
              <li><Link to="/help">Raise a ticket</Link></li>
              <li><Link to="/help">Payment FAQ</Link></li>
              <li><Link to="/help">Delivery policy</Link></li>
            </ul>
          </div>

          <div>
            <h5>Partners</h5>
            <ul>
              <li>
                <button className="btn-ghost" style={{ padding: 0, background: 'none', border: 0, color: 'inherit', fontSize: 'inherit' }} onClick={() => openAuth('signup')}>
                  Become a distributor
                </button>
              </li>
              <li><Link to="/distributor">Distributor workspace</Link></li>
              <li><Link to="/admin">Admin console</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-base">
          <span>© {new Date().getFullYear()} Hotel Express. Offline payments only.</span>
          <span>About · Terms · Privacy</span>
        </div>
      </div>
    </footer>
  )
}
