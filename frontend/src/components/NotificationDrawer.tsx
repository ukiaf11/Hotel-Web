import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { relativeTime } from '../lib/format'
import { useNotificationStore, playChime } from '../store/notifications'
import { useUIStore } from '../store/ui'
import { Icon, type IconName } from './Icons'
import { Button, EmptyState, Toggle } from './ui'

const TONE: Record<string, { icon: IconName; className: string }> = {
  order: { icon: 'package', className: 'badge-brand' },
  ticket: { icon: 'ticket', className: 'badge-info' },
  system: { icon: 'info', className: 'badge-warning' },
}

export function NotificationDrawer() {
  const open = useUIStore((state) => state.notificationsOpen)
  const setOpen = useUIStore((state) => state.setNotificationsOpen)
  const { notifications, unreadCount, markAsRead, markAllAsRead, sound, setSound } = useNotificationStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null

  const activate = async (id: number, link: string, isRead: boolean) => {
    if (!isRead) await markAsRead(id)
    setOpen(false)
    if (link) navigate(link)
  }

  return (
    <div className="overlay" style={{ padding: 0, placeItems: 'stretch' }} onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <aside className="drawer" role="dialog" aria-label="Notifications">
        <div className="row-between" style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3>Notifications</h3>
            <p className="tiny muted">{unreadCount ? `${unreadCount} unread` : 'You are all caught up'}</p>
          </div>
          <div className="row" style={{ gap: 4 }}>
            <Button size="sm" variant="ghost" onClick={() => void markAllAsRead()} disabled={!unreadCount}>
              Mark all read
            </Button>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close notifications">
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>

        <div className="grow" style={{ overflowY: 'auto' }}>
          {notifications.length ? (
            notifications.map((item) => {
              const tone = TONE[item.type] ?? TONE.system
              return (
                <button
                  key={item.id}
                  className={`notif-item ${item.is_read ? '' : 'unread'}`}
                  onClick={() => void activate(item.id, item.link, item.is_read)}
                >
                  <span className={`notif-icon badge ${tone.className}`}>
                    <Icon name={tone.icon} size={16} />
                  </span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <strong className="small" style={{ display: 'block' }}>{item.title}</strong>
                    <span className="tiny muted" style={{ display: 'block' }}>{item.body}</span>
                    <span className="tiny muted">{relativeTime(item.created_at)}</span>
                  </span>
                  {!item.is_read ? <span className="dot" style={{ color: 'var(--brand-primary)', marginTop: 6 }} /> : null}
                </button>
              )
            })
          ) : (
            <EmptyState icon="bell" title="No notifications yet" body="Order updates and support replies will appear here." />
          )}
        </div>

        <div className="stack" style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border)', gap: 'var(--space-3)' }}>
          <strong className="small">Sound alerts</strong>
          <Toggle checked={sound.enabled} onChange={(enabled) => setSound({ enabled })} label="Play a chime for new alerts" brand />
          <label className="field">
            <span className="field-label">Volume — {Math.round(sound.volume * 100)}%</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={sound.volume}
              disabled={!sound.enabled}
              onChange={(event) => setSound({ volume: Number(event.target.value) })}
              style={{ accentColor: 'var(--brand-primary)' }}
            />
          </label>
          <label className="field">
            <span className="field-label">Alert tone</span>
            <select
              className="form-input"
              value={sound.tone}
              disabled={!sound.enabled}
              onChange={(event) => setSound({ tone: event.target.value as typeof sound.tone })}
            >
              <option value="chime_soft">Chime — soft</option>
              <option value="alert_loud">Alert — loud</option>
              <option value="ping">Ping</option>
            </select>
          </label>
          <Button size="sm" variant="soft" icon="bell" onClick={() => playChime(sound)} disabled={!sound.enabled}>
            Preview tone
          </Button>
        </div>
      </aside>
    </div>
  )
}
