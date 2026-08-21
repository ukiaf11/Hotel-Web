import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { Icon, type IconName } from '../../components/Icons'
import { SalesChart } from '../../components/SalesChart'
import { Alert, Badge, Button, Card, EmptyState, Skeleton } from '../../components/ui'
import { money, prettySlot, relativeTime } from '../../lib/format'
import { errorMessage } from '../../services/errors'
import { useDistributorQueueStore, useDistributorStore } from '../../store/distributor'
import { playChime, useNotificationStore } from '../../store/notifications'
import { useUIStore } from '../../store/ui'

const KPI_META: { key: keyof KPIShape; label: string; icon: IconName; tone: string; money?: boolean }[] = [
  { key: 'today_revenue', label: "Today's revenue", icon: 'wallet', tone: 'badge-open', money: true },
  { key: 'active_orders_count', label: 'Active orders', icon: 'fire', tone: 'badge-brand' },
  { key: 'scheduled_orders_count', label: 'Scheduled ahead', icon: 'calendar', tone: 'badge-info' },
  { key: 'active_deliveries_count', label: 'Out for delivery', icon: 'truck', tone: 'badge-warning' },
]

interface KPIShape {
  today_revenue: number
  active_orders_count: number
  scheduled_orders_count: number
  active_deliveries_count: number
}

/** Counts up to the KPI value on mount for a bit of life (doc 09). */
function CountUp({ value, money: isMoney }: { value: number; money?: boolean }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let frame = 0
    const total = 26
    const tick = () => {
      frame += 1
      const eased = 1 - (1 - frame / total) ** 3
      setDisplay(value * eased)
      if (frame < total) requestAnimationFrame(tick)
      else setDisplay(value)
    }
    requestAnimationFrame(tick)
  }, [value])

  return <span>{isMoney ? money(display) : Math.round(display)}</span>
}

export function DashboardPage() {
  const { kpis, isLoading, error, fetchKPIs } = useDistributorStore()
  const { incoming, fetchQueue, updateOrderStatus } = useDistributorQueueStore()
  const sound = useNotificationStore((state) => state.sound)
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications)
  const toast = useUIStore((state) => state.toast)
  const knownIds = useRef<Set<number>>(new Set())
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    void fetchKPIs()
    void fetchQueue()
    const timer = setInterval(() => {
      void fetchQueue()
      void fetchNotifications()
    }, 15000)
    return () => clearInterval(timer)
  }, [fetchKPIs, fetchQueue, fetchNotifications])

  // Chime whenever a genuinely new "placed" order appears in the incoming lane.
  useEffect(() => {
    const fresh = incoming.filter((order) => !knownIds.current.has(order.id))
    if (knownIds.current.size && fresh.length) {
      playChime(sound)
      toast('info', `${fresh.length} new order${fresh.length > 1 ? 's' : ''} received`)
    }
    knownIds.current = new Set(incoming.map((order) => order.id))
  }, [incoming, sound, toast])

  const act = async (id: number, status: string) => {
    setBusy(id)
    try {
      await updateOrderStatus(id, status, status === 'cancelled' ? 'Rejected from dashboard' : '')
      await fetchKPIs()
      toast('success', status === 'accepted' ? 'Order accepted' : 'Order rejected')
    } catch (actError) {
      toast('error', 'Action failed', errorMessage(actError))
    } finally {
      setBusy(null)
    }
  }

  if (error) return <Alert tone="danger">{error}</Alert>

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <div className="kpi-grid">
        {KPI_META.map((meta) => (
          <div key={meta.key} className="kpi">
            <span className={`kpi-icon badge ${meta.tone}`}>
              <Icon name={meta.icon} size={17} />
            </span>
            <span className="kpi-label">{meta.label}</span>
            <span className="kpi-value">
              {isLoading || !kpis ? <Skeleton height={30} width={90} /> : <CountUp value={kpis[meta.key]} money={meta.money} />}
            </span>
          </div>
        ))}
      </div>

      <Card className="stack">
        <div className="panel-title">
          <h3>
            Incoming alerts{' '}
            {incoming.length ? <Badge tone="badge-brand"><span className="dot dot-pulse" />{incoming.length} new</Badge> : null}
          </h3>
          <Link to="/distributor/orders" className="link-chip">
            Open full queue <Icon name="arrowRight" size={13} />
          </Link>
        </div>

        {incoming.length ? (
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            {incoming.map((order) => (
              <div key={order.id} className="queue-card alert">
                <div className="row-between wrap">
                  <div>
                    <strong>Order #{order.id}</strong>
                    <span className="small muted"> · {order.customer_name}</span>
                    <p className="tiny muted">
                      {order.items.map((line) => `${line.name} ×${line.quantity}`).join(', ')}
                    </p>
                  </div>
                  <div className="stack" style={{ alignItems: 'flex-end', gap: 2 }}>
                    <strong className="price">{money(order.total_price)}</strong>
                    <span className="tiny muted">
                      {order.delivery_type === 'delivery' ? 'Delivery' : 'Pickup'} · {prettySlot(order.scheduled_time.split(' ')[1] ?? '')}
                    </span>
                    <span className="tiny muted">{relativeTime(order.placed_at)}</span>
                  </div>
                </div>
                <div className="row">
                  <Button size="sm" variant="success" icon="check" loading={busy === order.id} onClick={() => void act(order.id, 'accepted')}>
                    Accept
                  </Button>
                  <Button size="sm" variant="outline-danger" icon="close" loading={busy === order.id} onClick={() => void act(order.id, 'cancelled')}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="checkCircle" title="No orders waiting" body="New orders appear here the moment a customer checks out, with a sound alert." />
        )}
      </Card>

      <Card className="stack">
        <div className="panel-title">
          <h3>Daily performance — last 7 days</h3>
          <Link to="/distributor/reports" className="link-chip">
            Full reports <Icon name="arrowRight" size={13} />
          </Link>
        </div>
        {isLoading || !kpis ? (
          <Skeleton height={220} />
        ) : (
          <SalesChart
            data={kpis.weekly_sales_trend.map((row) => ({ label: row.day, value: row.sales }))}
            type="bar"
            ariaLabel="Revenue for the last seven days"
          />
        )}
      </Card>
    </div>
  )
}
