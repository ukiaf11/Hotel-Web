import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Icon } from '../../components/Icons'
import { Alert, Badge, Button, Card, EmptyState, Skeleton } from '../../components/ui'
import { money, prettyDateTime } from '../../lib/format'
import type { OrderStatus } from '../../lib/types'
import { errorMessage } from '../../services/errors'
import { useActiveOrderStore } from '../../store/orders'
import { useUIStore } from '../../store/ui'

const FLOW: { key: OrderStatus | 'fulfilment'; label: string; pickupLabel?: string }[] = [
  { key: 'placed', label: 'Placed' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'fulfilment', label: 'Out for delivery', pickupLabel: 'Ready for pickup' },
  { key: 'completed', label: 'Completed' },
]

const ORDER_INDEX: Record<string, number> = {
  placed: 0,
  accepted: 1,
  preparing: 2,
  out_for_delivery: 3,
  ready_for_pickup: 3,
  completed: 4,
}

export function TrackOrderPage() {
  const { id } = useParams()
  const orderId = Number(id)
  const { order, isLoading, error, startPolling, stopPolling, cancelOrder, fetchActive } = useActiveOrderStore()
  const { toast, askConfirm } = useUIStore()

  useEffect(() => {
    if (!orderId) return
    startPolling(orderId)
    return () => stopPolling()
  }, [orderId, startPolling, stopPolling])

  if (isLoading && !order) {
    return (
      <div className="shell section stack">
        <Skeleton height={150} radius={22} />
        <Skeleton height={110} />
        <Skeleton height={200} />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="shell section">
        <EmptyState icon="package" title="Order not found" body={error || 'This order does not exist or belongs to another account.'} action={<Link className="btn btn-primary" to="/orders">Back to order history</Link>} />
      </div>
    )
  }

  const currentIndex = ORDER_INDEX[order.status] ?? 0
  const cancelled = order.status === 'cancelled'
  const isDelivery = order.delivery_type === 'delivery'

  const directionsUrl =
    isDelivery && order.user_coordinates && order.hotel_coordinates
      ? `https://www.google.com/maps/dir/?api=1&origin=${order.hotel_coordinates.lat},${order.hotel_coordinates.lng}&destination=${order.user_coordinates.lat},${order.user_coordinates.lng}`
      : order.hotel_map_url

  const confirmCancel = () =>
    askConfirm({
      title: 'Cancel this order?',
      body: 'The hotel will be notified immediately. This cannot be undone.',
      confirmLabel: 'Yes, cancel order',
      danger: true,
      onConfirm: async () => {
        try {
          await cancelOrder(order.order_id)
          void fetchActive()
          toast('success', 'Order cancelled')
        } catch (cancelError) {
          toast('error', 'Could not cancel', errorMessage(cancelError))
        }
      },
    })

  return (
    <div className="shell section stack" style={{ gap: 'var(--space-5)' }}>
      <div className={cancelled ? '' : 'success-hero'} style={cancelled ? {} : undefined}>
        {cancelled ? (
          <Alert tone="danger" icon="xCircle">
            <strong>Order #{order.order_id} was cancelled</strong>
            No payment is due. You can reorder any time from your order history.
          </Alert>
        ) : (
          <>
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              <Badge>
                <Icon name="checkCircle" size={13} /> {order.status === 'completed' ? 'Order completed' : 'Order placed successfully'}
              </Badge>
              <h1>Order #{order.order_id}</h1>
              <p style={{ opacity: 0.92 }}>
                {isDelivery ? 'Estimated delivery' : 'Ready for pickup'} · {prettyDateTime(order.eta)}
              </p>
            </div>
            <div className="stack" style={{ gap: 'var(--space-1)', textAlign: 'right' }}>
              <span className="tiny" style={{ opacity: 0.85 }}>Payable offline</span>
              <strong style={{ fontSize: 'var(--text-3xl)', fontFamily: 'var(--font-heading)' }}>{money(order.total_amount)}</strong>
              <span className="tiny" style={{ opacity: 0.85 }}>
                {isDelivery ? 'Please have exact change ready for cash on delivery' : 'Please pay at the front counter when picking up'}
              </span>
            </div>
          </>
        )}
      </div>

      <Card className="stack">
        <h3>Track your order status</h3>
        <div className="stepper">
          {FLOW.map((step, index) => {
            const label = step.key === 'fulfilment' && !isDelivery ? step.pickupLabel! : step.label
            const state = cancelled
              ? index === 0
                ? 'cancelled'
                : 'pending'
              : index < currentIndex
                ? 'done'
                : index === currentIndex
                  ? 'current'
                  : 'pending'
            return (
              <div key={step.label} className={`step ${state}`}>
                <span className="step-dot">
                  {state === 'done' ? <Icon name="check" size={16} /> : state === 'cancelled' ? <Icon name="close" size={16} /> : <span className="dot" />}
                </span>
                <span className="step-label">{label}</span>
                {index === 0 ? <span className="tiny muted">{prettyDateTime(order.placed_at)}</span> : null}
                {index === 1 && order.accepted_at ? <span className="tiny muted">{prettyDateTime(order.accepted_at)}</span> : null}
                {index === 4 && order.completed_at ? <span className="tiny muted">{prettyDateTime(order.completed_at)}</span> : null}
              </div>
            )
          })}
        </div>
      </Card>

      <div className="split-2">
        <Card className="stack">
          <h4>Distributor details</h4>
          <strong>{order.hotel_name}</strong>
          <span className="hotel-meta">
            <Icon name="pin" size={14} /> {order.hotel_address || 'Address not set'}
          </span>
          <div className="row wrap">
            {order.hotel_phone ? (
              <a className="btn btn-secondary btn-sm" href={`tel:${order.hotel_phone}`}>
                <Icon name="phone" size={14} /> Call distributor
              </a>
            ) : null}
            <a className="btn btn-ghost btn-sm" href={order.hotel_map_url} target="_blank" rel="noreferrer">
              <Icon name="pin" size={14} /> Hotel location
            </a>
          </div>
        </Card>

        <Card className="stack">
          <h4>Route &amp; map</h4>
          <span className="hotel-meta">
            <Icon name={isDelivery ? 'truck' : 'store'} size={14} />
            {isDelivery ? order.user_address || 'Delivery address on file' : 'Collect at the hotel counter'}
          </span>
          <a className="btn btn-secondary btn-sm" href={directionsUrl} target="_blank" rel="noreferrer" style={{ width: 'fit-content' }}>
            <Icon name="external" size={14} /> View directions on Google Maps
          </a>
        </Card>
      </div>

      <Card className="stack">
        <h4>Items in this order</h4>
        {order.items.map((line) => (
          <div key={line.name} className="summary-line">
            <span>
              {line.name} <span className="muted">×{line.quantity}</span>
            </span>
            <span className="strong">{money(line.price * line.quantity)}</span>
          </div>
        ))}
        {order.special_instructions ? (
          <Alert tone="info" icon="message">
            <strong>Your note to the kitchen</strong>
            {order.special_instructions}
          </Alert>
        ) : null}
        <div className="summary-total">
          <span>Total ({order.payment_method})</span>
          <span>{money(order.total_amount)}</span>
        </div>
      </Card>

      <div className="row wrap">
        {order.can_cancel ? (
          <Button variant="outline-danger" icon="close" onClick={confirmCancel}>
            Cancel order
          </Button>
        ) : !cancelled && order.status !== 'completed' ? (
          <Alert tone="warning" icon="info">
            This order is being prepared and can no longer be cancelled. Contact the hotel for adjustments.
          </Alert>
        ) : null}
        <Link className="btn btn-ghost" to="/orders">
          <Icon name="list" size={15} /> All my orders
        </Link>
        <span className="tiny muted row">
          <Icon name="refresh" size={13} /> Status refreshes automatically every 10 seconds
        </span>
      </div>
    </div>
  )
}
