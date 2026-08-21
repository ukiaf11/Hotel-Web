import { useEffect, useState } from 'react'

import { Icon, type IconName } from '../../components/Icons'
import { Alert, Badge, Button, Card, EmptyState, Skeleton, TextArea, TextInput, Toggle } from '../../components/ui'
import { money, prettyDate, relativeTime } from '../../lib/format'
import type { PendingHotel } from '../../lib/types'
import { errorMessage } from '../../services/errors'
import { useSyncedState } from '../../hooks/useSyncedState'
import { useAdminStore } from '../../store/admin'
import { useUIStore } from '../../store/ui'

type Section = 'overview' | 'verification' | 'tickets' | 'settings'

const NAV: { key: Section; label: string; icon: IconName }[] = [
  { key: 'overview', label: 'System overview', icon: 'dashboard' },
  { key: 'verification', label: 'Verification queue', icon: 'shield' },
  { key: 'tickets', label: 'Support tickets', icon: 'inbox' },
  { key: 'settings', label: 'Global settings', icon: 'settings' },
]

export function AdminPage() {
  const { stats, pendingHotels, allHotels, openTickets, config, isLoading, error, fetchAll, verifyHotel, replyToTicket, saveConfig } = useAdminStore()
  const { toast, askConfirm } = useUIStore()

  const [section, setSection] = useState<Section>('overview')
  const [activeTicket, setActiveTicket] = useState<number | null>(null)
  const [reply, setReply] = useState('')
  const [rejecting, setRejecting] = useState<PendingHotel | null>(null)
  const [reason, setReason] = useState('')
  const [draftConfig, setDraftConfig] = useSyncedState(config, (value) => value)

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const approve = (hotel: PendingHotel) =>
    askConfirm({
      title: `Approve ${hotel.name}?`,
      body: 'The hotel becomes visible on the customer home feed immediately and the owner is notified.',
      confirmLabel: 'Approve and publish',
      onConfirm: async () => {
        await verifyHotel(hotel.id, true)
        toast('success', `${hotel.name} approved`)
      },
    })

  const reject = async () => {
    if (!rejecting) return
    try {
      await verifyHotel(rejecting.id, false, reason || 'Your listing needs changes before it can go live.')
      toast('warning', `${rejecting.name} rejected`, 'The owner has been notified with your reason.')
      setRejecting(null)
      setReason('')
    } catch (rejectError) {
      toast('error', 'Could not reject', errorMessage(rejectError))
    }
  }

  const send = async (ticketId: number, close: boolean) => {
    if (!reply.trim() && !close) return
    try {
      await replyToTicket(ticketId, reply, close)
      setReply('')
      toast('success', close ? 'Ticket resolved' : 'Reply sent')
    } catch (sendError) {
      toast('error', 'Could not send reply', errorMessage(sendError))
    }
  }

  const persistConfig = async () => {
    if (!draftConfig) return
    try {
      await saveConfig(draftConfig)
      toast('success', 'Global settings saved')
    } catch (configError) {
      toast('error', 'Could not save settings', errorMessage(configError))
    }
  }

  return (
    <div className="shell workspace">
      <nav className="side-nav" aria-label="Admin console">
        <div className="stack" style={{ padding: 'var(--space-3)', gap: 2 }}>
          <strong className="small">Admin console</strong>
          <span className="tiny muted">Superuser actions</span>
        </div>
        {NAV.map((entry) => (
          <button key={entry.key} className={`side-link ${section === entry.key ? 'active' : ''}`} onClick={() => setSection(entry.key)}>
            <Icon name={entry.icon} size={16} />
            {entry.label}
            {entry.key === 'verification' && pendingHotels.length ? <Badge tone="badge-warning">{pendingHotels.length}</Badge> : null}
            {entry.key === 'tickets' && openTickets.length ? <Badge tone="badge-info">{openTickets.length}</Badge> : null}
          </button>
        ))}
      </nav>

      <div className="stack" style={{ gap: 'var(--space-5)' }}>
        {error ? <Alert tone="danger">{error}</Alert> : null}

        {section === 'overview' ? (
          <>
            <div className="kpi-grid">
              {[
                { label: 'Customers', value: stats?.total_users ?? 0, icon: 'users' as IconName },
                { label: 'Verified hotels', value: stats?.total_hotels ?? 0, icon: 'store' as IconName },
                { label: 'Pending approval', value: stats?.pending_hotels ?? 0, icon: 'shield' as IconName },
                { label: 'Total orders', value: stats?.total_orders ?? 0, icon: 'package' as IconName },
                { label: 'Gross volume', value: money(stats?.gross_volume ?? 0), icon: 'wallet' as IconName },
                { label: 'Open tickets', value: stats?.open_tickets ?? 0, icon: 'inbox' as IconName },
              ].map((kpi) => (
                <div key={kpi.label} className="kpi">
                  <span className="kpi-icon badge badge-brand">
                    <Icon name={kpi.icon} size={16} />
                  </span>
                  <span className="kpi-label">{kpi.label}</span>
                  <span className="kpi-value" style={{ fontSize: 'var(--text-2xl)' }}>
                    {isLoading ? <Skeleton height={26} width={70} /> : kpi.value}
                  </span>
                </div>
              ))}
            </div>

            <Card className="stack">
              <div className="panel-title">
                <h3>All hotels</h3>
                <Button size="sm" variant="ghost" icon="refresh" onClick={() => void fetchAll()}>
                  Refresh
                </Button>
              </div>
              {isLoading ? (
                <Skeleton height={200} />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Hotel</th>
                        <th>Owner</th>
                        <th>Contact</th>
                        <th>Registered</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allHotels.map((hotel) => (
                        <tr key={hotel.id}>
                          <td>
                            <strong>{hotel.name}</strong>
                            <p className="tiny muted">{hotel.address || 'No address set'}</p>
                          </td>
                          <td className="muted">
                            {hotel.owner_name}
                            <p className="tiny muted">{hotel.owner_email}</p>
                          </td>
                          <td className="muted">{hotel.contact_number || '—'}</td>
                          <td className="muted">{prettyDate(hotel.created_at)}</td>
                          <td>
                            <Badge tone={hotel.is_verified ? 'badge-open' : 'badge-warning'}>
                              {hotel.is_verified ? 'Verified' : 'Pending'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        ) : null}

        {section === 'verification' ? (
          <Card className="stack">
            <div className="panel-title">
              <h3>Hotel verification queue</h3>
              <Badge tone="badge-warning">{pendingHotels.length} pending</Badge>
            </div>

            {isLoading ? (
              <Skeleton height={180} />
            ) : pendingHotels.length ? (
              <div className="stack" style={{ gap: 'var(--space-4)' }}>
                {pendingHotels.map((hotel) => (
                  <Card key={hotel.id} className="stack card-hover">
                    <div className="row-between wrap">
                      <div>
                        <h4>{hotel.name}</h4>
                        <p className="small muted">{hotel.address || 'No address supplied'}</p>
                      </div>
                      <Badge tone="badge-warning" icon="clock">
                        Registered {relativeTime(hotel.created_at)}
                      </Badge>
                    </div>

                    <div className="split-3">
                      <div>
                        <span className="tiny muted">Owner</span>
                        <p className="small strong">{hotel.owner_name}</p>
                        <p className="tiny muted">{hotel.owner_email}</p>
                      </div>
                      <div>
                        <span className="tiny muted">Contact</span>
                        <p className="small strong">{hotel.contact_number || '—'}</p>
                      </div>
                      <div>
                        <span className="tiny muted">Coordinates</span>
                        <p className="small strong mono">
                          {hotel.latitude != null ? `${hotel.latitude.toFixed(4)}, ${hotel.longitude?.toFixed(4)}` : 'Not pinned'}
                        </p>
                        {hotel.latitude != null ? (
                          <a
                            className="link-chip"
                            href={`https://www.google.com/maps/search/?api=1&query=${hotel.latitude},${hotel.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Icon name="pin" size={12} /> Verify on map
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div className="row wrap">
                      <Button variant="success" icon="check" onClick={() => approve(hotel)}>
                        Approve
                      </Button>
                      <Button variant="outline-danger" icon="close" onClick={() => setRejecting(hotel)}>
                        Deny / flag
                      </Button>
                    </div>

                    {rejecting?.id === hotel.id ? (
                      <div className="stack" style={{ paddingTop: 'var(--space-3)', borderTop: '1px dashed var(--border)' }}>
                        <TextArea
                          label="Reason sent to the distributor"
                          placeholder="Explain what needs to change before approval…"
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                        />
                        <div className="row">
                          <Button variant="danger" onClick={() => void reject()}>
                            Confirm rejection
                          </Button>
                          <Button variant="ghost" onClick={() => setRejecting(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState icon="checkCircle" title="Verification queue is clear" body="Every registered hotel has been reviewed." />
            )}
          </Card>
        ) : null}

        {section === 'tickets' ? (
          <Card className="stack">
            <div className="panel-title">
              <h3>Open support tickets</h3>
              <Badge tone="badge-info">{openTickets.length}</Badge>
            </div>

            {isLoading ? (
              <Skeleton height={200} />
            ) : openTickets.length ? (
              <div className="stack" style={{ gap: 'var(--space-3)' }}>
                {openTickets.map((ticket) => (
                  <Card key={ticket.id} className="stack">
                    <button
                      className="row-between wrap"
                      style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', width: '100%' }}
                      onClick={() => setActiveTicket(activeTicket === ticket.id ? null : ticket.id)}
                      aria-expanded={activeTicket === ticket.id}
                    >
                      <span>
                        <strong>{ticket.subject}</strong>
                        <p className="tiny muted">
                          #{ticket.id} · {ticket.user_name} ({ticket.user_email})
                          {ticket.order_id ? ` · order #${ticket.order_id}` : ''} · {relativeTime(ticket.updated_at)}
                        </p>
                      </span>
                      <Badge tone={ticket.status === 'pending' ? 'badge-warning' : 'badge-info'}>{ticket.status}</Badge>
                    </button>

                    {activeTicket === ticket.id ? (
                      <div className="stack">
                        <div className="alert alert-info" style={{ display: 'block' }}>
                          <strong className="tiny">{ticket.user_name}</strong>
                          <p className="small">{ticket.message}</p>
                        </div>
                        {ticket.responses.map((response, index) => (
                          <div key={index} className="card" style={{ padding: 'var(--space-3)', background: 'var(--surface-sunken)' }}>
                            <strong className="tiny">{response.sender}</strong>
                            <p className="small">{response.message}</p>
                            <span className="tiny muted">{relativeTime(response.timestamp)}</span>
                          </div>
                        ))}
                        <TextArea label="Reply to the customer" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Type your response…" />
                        <div className="row">
                          <Button variant="primary" icon="send" onClick={() => void send(ticket.id, false)}>
                            Send response
                          </Button>
                          <Button variant="secondary" icon="check" onClick={() => void send(ticket.id, true)}>
                            Close ticket
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState icon="inbox" title="No open tickets" body="Every customer dispute has been resolved." />
            )}
          </Card>
        ) : null}

        {section === 'settings' && draftConfig ? (
          <Card className="stack">
            <div className="panel-title">
              <h3>Global configuration</h3>
            </div>

            <Toggle
              checked={draftConfig.maintenance_mode}
              onChange={(maintenance_mode) => setDraftConfig({ ...draftConfig, maintenance_mode })}
              label="Site maintenance mode"
            />
            <p className="small muted">
              Shows a banner across the platform and blocks new order creation while enabled.
            </p>

            <TextInput
              label="Maintenance banner message"
              value={draftConfig.maintenance_message}
              onChange={(event) => setDraftConfig({ ...draftConfig, maintenance_message: event.target.value })}
            />

            <Toggle
              checked={draftConfig.allow_registrations}
              onChange={(allow_registrations) => setDraftConfig({ ...draftConfig, allow_registrations })}
              label="Allow new account registrations"
              brand
            />

            {draftConfig.maintenance_mode ? (
              <Alert tone="warning" icon="warning">
                Maintenance mode is about to be enabled — customers will not be able to place new orders.
              </Alert>
            ) : null}

            <Button variant="primary" icon="check" onClick={() => void persistConfig()} style={{ width: 'fit-content' }}>
              Save global settings
            </Button>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
