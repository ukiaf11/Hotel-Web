import { useEffect, useRef, useState, type ReactNode } from 'react'

import { Icon } from '../../components/Icons'
import { Alert, Badge, Button, EmptyState, Modal, Select, Skeleton, TextArea } from '../../components/ui'
import { money, prettySlot, relativeTime, STATUS_LABEL } from '../../lib/format'
import type { QueueCard } from '../../lib/types'
import { errorMessage } from '../../services/errors'
import { useAuthStore } from '../../store/auth'
import { useDistributorQueueStore, useDistributorStore } from '../../store/distributor'
import { playChime, useNotificationStore } from '../../store/notifications'
import { useUIStore } from '../../store/ui'

const REJECT_REASONS = [
  'Kitchen is at capacity',
  'Ingredient out of stock',
  'Outside delivery boundary',
  'Closing earlier today',
  'Other (explain below)',
]

interface LaneProps {
  title: string
  tone: string
  orders: QueueCard[]
  children: (order: QueueCard) => ReactNode
}

function Lane({ title, tone, orders, children }: LaneProps) {
  return (
    <section className="lane">
      <div className="lane-head">
        <span className="row" style={{ gap: 6 }}>
          {title}
          <Badge tone={tone}>{orders.length}</Badge>
        </span>
      </div>
      {orders.length ? (
        orders.map((order) => (
          <article key={order.id} className={`queue-card ${order.status === 'placed' ? 'alert' : ''}`}>
            <div className="row-between">
              <strong className="small">Order #{order.id}</strong>
              <Badge tone={order.delivery_type === 'delivery' ? 'badge-info' : ''} icon={order.delivery_type === 'delivery' ? 'truck' : 'store'}>
                {order.delivery_type === 'delivery' ? 'Delivery' : 'Pickup'}
              </Badge>
            </div>

            <span className="tiny muted">
              {order.customer_name} · {order.customer_phone || 'no phone'}
            </span>

            <ul className="queue-items">
              {order.items.map((line) => (
                <li key={line.name}>
                  {line.quantity} × {line.name}
                </li>
              ))}
            </ul>

            {order.special_instructions ? (
              <span className="tiny" style={{ color: 'var(--status-warning)' }}>
                <Icon name="message" size={11} /> {order.special_instructions}
              </span>
            ) : null}

            <div className="row-between">
              <strong className="small">{money(order.total_price)}</strong>
              <span className="tiny muted">{prettySlot(order.scheduled_time.split(' ')[1] ?? '')}</span>
            </div>
            <span className="tiny muted">Placed {relativeTime(order.placed_at)}</span>

            <div className="row wrap" style={{ gap: 4 }}>{children(order)}</div>
          </article>
        ))
      ) : (
        <p className="tiny muted center" style={{ padding: 'var(--space-4) 0' }}>
          Nothing here
        </p>
      )}
    </section>
  )
}

export function QueuePage() {
  const { incoming, preparing, ready, completed, isLoading, error, fetchQueue, updateOrderStatus } = useDistributorQueueStore()
  const hotel = useDistributorStore((state) => state.hotel)
  const { user } = useAuthStore()
  const { toast } = useUIStore()
  const sound = useNotificationStore((state) => state.sound)

  const [busy, setBusy] = useState<number | null>(null)
  const [rejecting, setRejecting] = useState<QueueCard | null>(null)
  const [reason, setReason] = useState(REJECT_REASONS[0])
  const [note, setNote] = useState('')
  const [receipt, setReceipt] = useState<QueueCard | null>(null)
  const knownIds = useRef<Set<number>>(new Set())

  useEffect(() => {
    void fetchQueue()
    const timer = setInterval(() => void fetchQueue(), 12000)
    return () => clearInterval(timer)
  }, [fetchQueue])

  useEffect(() => {
    const fresh = incoming.filter((order) => !knownIds.current.has(order.id))
    if (knownIds.current.size && fresh.length) playChime(sound)
    knownIds.current = new Set(incoming.map((order) => order.id))
  }, [incoming, sound])

  const isCourier = user?.role === 'courier'
  const isCook = user?.role === 'cook'

  const act = async (id: number, status: string, rejectionReason = '') => {
    setBusy(id)
    try {
      await updateOrderStatus(id, status, rejectionReason)
      toast('success', `Order #${id} → ${STATUS_LABEL[status] ?? status}`)
    } catch (actError) {
      toast('error', 'Update failed', errorMessage(actError))
    } finally {
      setBusy(null)
    }
  }

  const confirmReject = async () => {
    if (!rejecting) return
    const finalReason = reason.startsWith('Other') ? note.trim() || 'Rejected by the hotel' : reason
    await act(rejecting.id, 'cancelled', finalReason)
    setRejecting(null)
    setNote('')
  }

  const print = (order: QueueCard) => {
    setReceipt(order)
    setTimeout(() => window.print(), 120)
  }

  if (isLoading) {
    return (
      <div className="kanban">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} height={280} />
        ))}
      </div>
    )
  }

  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {isCourier ? (
        <Alert tone="info" icon="truck">
          Delivery agent view — you can dispatch and complete orders. Menu, logistics and reports are outside your scope.
        </Alert>
      ) : null}

      <div className="row-between wrap">
        <h3>Active order queue</h3>
        <Button size="sm" variant="ghost" icon="refresh" onClick={() => void fetchQueue()}>
          Refresh
        </Button>
      </div>

      <div className="kanban">
        <Lane title="Incoming" tone="badge-brand" orders={incoming}>
          {(order) => (
            <>
              <Button size="sm" variant="success" icon="check" disabled={isCourier} loading={busy === order.id} onClick={() => void act(order.id, 'accepted')}>
                Accept
              </Button>
              <Button size="sm" variant="outline-danger" icon="close" disabled={isCourier} onClick={() => setRejecting(order)}>
                Reject
              </Button>
            </>
          )}
        </Lane>

        <Lane title="Preparing" tone="badge-warning" orders={preparing}>
          {(order) => (
            <>
              {order.status === 'accepted' ? (
                <Button size="sm" variant="primary" icon="fire" disabled={isCourier} loading={busy === order.id} onClick={() => void act(order.id, 'preparing')}>
                  Start cooking
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  icon="check"
                  loading={busy === order.id}
                  onClick={() => void act(order.id, order.delivery_type === 'delivery' ? 'out_for_delivery' : 'ready_for_pickup')}
                >
                  Mark ready
                </Button>
              )}
              <Button size="sm" variant="ghost" icon="printer" onClick={() => print(order)}>
                Receipt
              </Button>
            </>
          )}
        </Lane>

        <Lane title="Dispatch / ready" tone="badge-info" orders={ready}>
          {(order) => (
            <>
              <Button size="sm" variant="success" icon="checkCircle" loading={busy === order.id} onClick={() => void act(order.id, 'completed')}>
                Complete
              </Button>
              {order.map_url ? (
                <a className="btn btn-ghost btn-sm" href={order.map_url} target="_blank" rel="noreferrer">
                  <Icon name="pin" size={13} /> Route
                </a>
              ) : null}
            </>
          )}
        </Lane>

        <Lane title="Completed / cancelled" tone="" orders={completed}>
          {(order) => (
            <>
              <Badge tone={order.status === 'completed' ? 'badge-open' : 'badge-closed'}>{STATUS_LABEL[order.status]}</Badge>
              <Button size="sm" variant="ghost" icon="printer" disabled={isCook} onClick={() => print(order)}>
                Receipt
              </Button>
            </>
          )}
        </Lane>
      </div>

      {!incoming.length && !preparing.length && !ready.length ? (
        <EmptyState icon="checkCircle" title="Queue is clear" body="Every order has been fulfilled. New tickets arrive here with a sound alert." />
      ) : null}

      <Modal open={Boolean(rejecting)} onClose={() => setRejecting(null)} title={`Reject order #${rejecting?.id ?? ''}`} subtitle="The customer is notified with the reason you pick.">
        <div className="stack">
          <Select label="Reason" value={reason} options={REJECT_REASONS.map((entry) => ({ value: entry, label: entry }))} onChange={(event) => setReason(event.target.value)} />
          {reason.startsWith('Other') ? (
            <TextArea label="Explain to the customer" value={note} onChange={(event) => setNote(event.target.value)} />
          ) : null}
          <Button variant="danger" block onClick={() => void confirmReject()}>
            Reject and notify customer
          </Button>
        </div>
      </Modal>

      {receipt ? (
        <div id="thermal-receipt">
          <h4>{hotel?.name ?? 'Hotel Express'}</h4>
          <div style={{ textAlign: 'center', fontSize: 11 }}>
            {hotel?.place}
            <br />
            {hotel?.contact_number}
          </div>
          <div className="rule" />
          <table>
            <tbody>
              <tr>
                <td>Order</td>
                <td className="right">#{receipt.id}</td>
              </tr>
              <tr>
                <td>Customer</td>
                <td className="right">{receipt.customer_name}</td>
              </tr>
              <tr>
                <td>Phone</td>
                <td className="right">{receipt.customer_phone}</td>
              </tr>
              <tr>
                <td>Type</td>
                <td className="right">{receipt.delivery_type === 'delivery' ? 'DELIVERY' : 'PICKUP'}</td>
              </tr>
              <tr>
                <td>Slot</td>
                <td className="right">{receipt.scheduled_time}</td>
              </tr>
            </tbody>
          </table>
          <div className="rule" />
          <table>
            <tbody>
              {receipt.items.map((line) => (
                <tr key={line.name}>
                  <td>
                    {line.quantity} x {line.name}
                  </td>
                  <td className="right">{(line.price * line.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="rule" />
          <table>
            <tbody>
              <tr>
                <td>
                  <strong>TOTAL</strong>
                </td>
                <td className="right">
                  <strong>{receipt.total_price.toFixed(2)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
          {receipt.address ? <div style={{ fontSize: 10, marginTop: 4 }}>Deliver to: {receipt.address}</div> : null}
          {receipt.special_instructions ? <div style={{ fontSize: 10 }}>Note: {receipt.special_instructions}</div> : null}
          <div className="rule" />
          <div style={{ textAlign: 'center', fontSize: 10 }}>
            OFFLINE PAYMENT — COLLECT ON DELIVERY
            <br />
            Thank you!
          </div>
        </div>
      ) : null}
    </div>
  )
}
