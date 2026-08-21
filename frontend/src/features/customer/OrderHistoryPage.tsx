import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Icon } from '../../components/Icons'
import { Alert, Badge, Button, Card, EmptyState, Modal, Pills, Skeleton, Stars, TextArea } from '../../components/ui'
import { downloadBlob, money, prettyDateTime, prettySlot, STATUS_LABEL, statusTone } from '../../lib/format'
import type { FoodItem, OrderHistoryItem } from '../../lib/types'
import { api } from '../../services/api'
import { errorMessage } from '../../services/errors'
import { useCartStore } from '../../store/cart'
import { useOrderHistoryStore } from '../../store/orders'
import { useUIStore } from '../../store/ui'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

export function OrderHistoryPage() {
  const navigate = useNavigate()
  const { history, currentPage, totalPages, totalCount, statusFilter, searchQuery, isLoading, error, fetchHistory, setSearchQuery, submitReview } =
    useOrderHistoryStore()
  const { toast, askConfirm } = useUIStore()
  const loadFromHistory = useCartStore((state) => state.loadFromHistory)
  const cartItems = useCartStore((state) => state.cartItems)

  const [reviewing, setReviewing] = useState<OrderHistoryItem | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    void fetchHistory(1, 'all')
  }, [fetchHistory])

  const visible = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return history
    return history.filter(
      (order) => order.hotel_name.toLowerCase().includes(query) || order.items_summary.toLowerCase().includes(query),
    )
  }, [history, searchQuery])

  const downloadInvoice = async (order: OrderHistoryItem) => {
    setBusyId(order.id)
    try {
      const blob = await api.blob(`/orders/${order.id}/invoice/`)
      downloadBlob(blob, `invoice-${order.id}.pdf`)
      toast('success', 'Invoice downloaded')
    } catch (downloadError) {
      toast('error', 'Invoice failed', errorMessage(downloadError))
    } finally {
      setBusyId(null)
    }
  }

  const reorder = async (order: OrderHistoryItem) => {
    const run = async () => {
      setBusyId(order.id)
      try {
        const menu = await api.get<{ items: FoodItem[] }>(`/hotels/${order.hotel_id}/menu/`)
        const added = loadFromHistory(order.hotel_id, order.hotel_name, order.items, menu.items)
        if (!added) {
          toast('warning', 'Nothing could be re-added', 'None of those dishes are currently available.')
          return
        }
        if (added < order.items.length) {
          toast('warning', 'Some items were skipped', 'Only the dishes still on the menu were added to your cart.')
        }
        navigate(`/hotels/${order.hotel_id}/schedule`)
      } catch (reorderError) {
        toast('error', 'Re-order failed', errorMessage(reorderError))
      } finally {
        setBusyId(null)
      }
    }

    if (cartItems.length) {
      askConfirm({
        title: 'Overwrite your active cart?',
        body: 'Re-ordering clears the items currently in your cart and replaces them with this order.',
        confirmLabel: 'Replace cart',
        onConfirm: run,
      })
      return
    }
    await run()
  }

  const sendReview = async () => {
    if (!reviewing) return
    try {
      await submitReview(reviewing.id, rating, comment)
      toast('success', 'Thanks for the review!')
      setReviewing(null)
      setComment('')
      setRating(5)
    } catch (reviewError) {
      toast('error', 'Could not save review', errorMessage(reviewError))
    }
  }

  return (
    <div className="shell section">
      <div className="page-title">
        <h1>Your order history</h1>
        <p className="soft">{totalCount} order{totalCount === 1 ? '' : 's'} placed with Hotel Express.</p>
      </div>

      <div className="row-between wrap" style={{ marginBottom: 'var(--space-4)', gap: 'var(--space-3)' }}>
        <Pills options={FILTERS} value={statusFilter} onChange={(key) => void fetchHistory(1, key)} />
        <div className="input-with-icon" style={{ maxWidth: 300, flex: '1 1 220px' }}>
          <Icon name="search" size={15} />
          <input
            className="form-input"
            placeholder="Search by hotel or meal…"
            aria-label="Search past orders"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {searchQuery ? (
            <button className="input-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
              <Icon name="close" size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {isLoading ? (
        <div className="stack">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} height={150} radius={14} />
          ))}
        </div>
      ) : visible.length ? (
        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          {visible.map((order) => {
            const isActive = !['completed', 'cancelled'].includes(order.status)
            return (
              <Card key={order.id} className="order-card animate-in">
                <div className="order-card-head">
                  <div>
                    <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
                      <strong>Order #{order.id}</strong>
                      <span className="muted small">·</span>
                      <Link to={`/hotels/${order.hotel_id}`} className="link-chip" style={{ padding: 0 }}>
                        {order.hotel_name}
                      </Link>
                    </div>
                    <span className="tiny muted">
                      {prettyDateTime(order.order_date)} · scheduled {order.scheduled_time.split(' ')[0]}{' '}
                      {prettySlot(order.scheduled_time.split(' ')[1] ?? '')}
                    </span>
                  </div>
                  <div className="row" style={{ gap: 'var(--space-2)' }}>
                    <Badge tone={statusTone(order.status)}>
                      {isActive ? <span className="dot dot-pulse" /> : null}
                      {STATUS_LABEL[order.status]}
                    </Badge>
                    <Badge icon={order.delivery_type === 'delivery' ? 'truck' : 'store'}>
                      {order.delivery_type === 'delivery' ? 'Delivery' : 'Pickup'}
                    </Badge>
                  </div>
                </div>

                <p className="small muted">{order.items_summary}</p>

                <div className="row-between wrap">
                  <strong className="price">
                    {money(order.total_amount)} <span className="tiny muted strong">({order.payment_method})</span>
                  </strong>
                  <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
                    {isActive ? (
                      <Link className="btn btn-primary btn-sm" to={`/orders/track/${order.id}`}>
                        <Icon name="pin" size={14} /> Track order
                      </Link>
                    ) : null}
                    {order.status === 'completed' ? (
                      <Button size="sm" variant="secondary" icon="refresh" loading={busyId === order.id} onClick={() => void reorder(order)}>
                        Re-order
                      </Button>
                    ) : null}
                    {order.status === 'completed' && !order.has_review ? (
                      <Button size="sm" variant="soft" icon="star" onClick={() => setReviewing(order)}>
                        Write review
                      </Button>
                    ) : order.has_review ? (
                      <Badge tone="badge-open" icon="check">Reviewed</Badge>
                    ) : null}
                    <Button size="sm" variant="ghost" icon="download" loading={busyId === order.id} onClick={() => void downloadInvoice(order)}>
                      Invoice
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon="package"
          title="No orders here yet"
          body="Once you place an order it will show up in this list with invoices and re-ordering."
          action={<Button variant="primary" onClick={() => navigate('/')}>Browse hotels</Button>}
        />
      )}

      {totalPages > 1 ? (
        <div className="row" style={{ justifyContent: 'center', marginTop: 'var(--space-5)' }}>
          <Button size="sm" variant="ghost" icon="chevronLeft" disabled={currentPage <= 1} onClick={() => void fetchHistory(currentPage - 1)}>
            Previous
          </Button>
          <span className="small muted">
            Page {currentPage} of {totalPages}
          </span>
          <Button size="sm" variant="ghost" iconRight="chevronRight" disabled={currentPage >= totalPages} onClick={() => void fetchHistory(currentPage + 1)}>
            Next
          </Button>
        </div>
      ) : null}

      <Modal open={Boolean(reviewing)} onClose={() => setReviewing(null)} title="Rate your order" subtitle={reviewing ? `${reviewing.hotel_name} · order #${reviewing.id}` : ''}>
        <div className="stack">
          <div className="stack" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
            <Stars value={rating} onChange={setRating} size={16} />
            <span className="small muted">{['Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating - 1]}</span>
          </div>
          <TextArea
            label="Tell others about the food and delivery"
            placeholder="The biryani arrived hot and right on schedule…"
            value={comment}
            maxLength={400}
            onChange={(event) => setComment(event.target.value)}
          />
          <Button variant="primary" block onClick={() => void sendReview()}>
            Submit review
          </Button>
        </div>
      </Modal>
    </div>
  )
}
