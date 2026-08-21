import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Icon } from '../../components/Icons'
import { MapPicker } from '../../components/MapPicker'
import { Alert, Button, Card, EmptyState, QuantityStepper, Select, TextArea } from '../../components/ui'
import { money, prettySlot } from '../../lib/format'
import { api } from '../../services/api'
import { errorMessage } from '../../services/errors'
import { useAuthStore } from '../../store/auth'
import { useCartStore } from '../../store/cart'
import { useActiveHotelStore } from '../../store/hotels'
import { useNotificationStore } from '../../store/notifications'
import { useActiveOrderStore } from '../../store/orders'
import { useProfileStore } from '../../store/profile'
import { useUIStore } from '../../store/ui'

const TAX_RATE = 0.05

export function CheckoutPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const { openAuth, toast } = useUIStore()
  const { hotel, fetchHotel } = useActiveHotelStore()
  const { addresses, fetchAddresses } = useProfileStore()
  const fetchActive = useActiveOrderStore((state) => state.fetchActive)
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications)

  const {
    cartItems,
    hotelId,
    hotelName,
    scheduledDate,
    scheduledTimeSlot,
    specialInstructions,
    deliveryType,
    address,
    latitude,
    longitude,
    updateQuantity,
    removeFromCart,
    setDeliveryType,
    setAddress,
    setSpecialInstructions,
    clearCart,
    subtotal,
  } = useCartStore()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (hotelId && hotel?.id !== hotelId) void fetchHotel(hotelId)
  }, [hotelId, hotel?.id, fetchHotel])

  useEffect(() => {
    if (isAuthenticated) void fetchAddresses()
  }, [isAuthenticated, fetchAddresses])

  // A hotel with delivery switched off can only be self-pickup (doc 04).
  useEffect(() => {
    if (hotel && !hotel.has_delivery && deliveryType === 'delivery') setDeliveryType('pickup')
  }, [hotel, deliveryType, setDeliveryType])

  useEffect(() => {
    if (!address && addresses.length) {
      const preferred = addresses.find((entry) => entry.is_default) ?? addresses[0]
      setAddress(preferred.address_line, preferred.latitude, preferred.longitude)
    }
  }, [addresses, address, setAddress])

  if (!cartItems.length) {
    return (
      <div className="shell section">
        <EmptyState
          icon="cart"
          title="Your cart is empty"
          body="Browse the home feed, add a few dishes, and they will show up here."
          action={<Button variant="primary" onClick={() => navigate('/')}>Browse hotels</Button>}
        />
      </div>
    )
  }

  const items = subtotal()
  const deliveryFee = deliveryType === 'delivery' ? (hotel?.flat_delivery_fee ?? 0) : 0
  const tax = Math.round(items * TAX_RATE * 100) / 100
  const total = Math.round((items + deliveryFee + tax) * 100) / 100
  const belowMinimum = deliveryType === 'delivery' && hotel ? items < hotel.min_order_amount : false
  const missingSchedule = !scheduledDate || !scheduledTimeSlot

  const placeOrder = async () => {
    if (!isAuthenticated) {
      openAuth('signup', 'checkout')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const result = await api.post<{ order_id: number }>('/orders/create/', {
        hotel_id: hotelId,
        items: cartItems.map((line) => ({ food_item_id: line.id, quantity: line.quantity })),
        delivery_date: scheduledDate,
        delivery_time_slot: scheduledTimeSlot,
        delivery_type: deliveryType,
        address: deliveryType === 'delivery' ? address : '',
        latitude: deliveryType === 'delivery' ? latitude : null,
        longitude: deliveryType === 'delivery' ? longitude : null,
        payment_method: 'offline',
        special_instructions: specialInstructions,
      })
      clearCart()
      void fetchActive()
      void fetchNotifications()
      toast('success', 'Order placed', 'The hotel has been notified and will confirm shortly.')
      navigate(`/orders/track/${result.order_id}`)
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="shell section">
      <div className="page-title">
        <h1>Checkout</h1>
        <p className="soft">
          Ordering from <strong>{hotelName || hotel?.name}</strong> · offline payment only.
        </p>
      </div>

      <div className="checkout-grid">
        <div className="stack" style={{ gap: 'var(--space-5)' }}>
          <Card className="stack">
            <div className="step-head">
              <span className="step-num">1</span>
              <h3>Delivery option</h3>
            </div>

            <div className="segmented">
              <button
                type="button"
                className="segment"
                aria-pressed={deliveryType === 'delivery'}
                disabled={!hotel?.has_delivery}
                title={hotel?.has_delivery ? undefined : 'This hotel does not offer home delivery. Please choose self-pickup.'}
                onClick={() => setDeliveryType('delivery')}
              >
                <span className="row" style={{ gap: 6 }}>
                  <Icon name="truck" size={17} />
                  <span className="segment-title">Home delivery</span>
                </span>
                <span className="tiny muted">
                  {hotel?.has_delivery ? `${money(hotel.flat_delivery_fee)} fee · ~${hotel.avg_delivery_minutes} min` : 'Unavailable for this hotel'}
                </span>
              </button>
              <button type="button" className="segment" aria-pressed={deliveryType === 'pickup'} onClick={() => setDeliveryType('pickup')}>
                <span className="row" style={{ gap: 6 }}>
                  <Icon name="store" size={17} />
                  <span className="segment-title">Self-pickup</span>
                </span>
                <span className="tiny muted">Collect at the counter · no fee</span>
              </button>
            </div>

            {!hotel?.has_delivery ? (
              <Alert tone="warning" icon="warning">
                Home delivery is disabled by this hotel. Your order is set to <strong>self-pickup</strong>.
              </Alert>
            ) : null}

            {deliveryType === 'delivery' ? (
              <div className="stack">
                {addresses.length ? (
                  <Select
                    label="Select an address from your profile"
                    value={address}
                    options={[
                      { value: '', label: 'Enter a new address…' },
                      ...addresses.map((entry) => ({
                        value: entry.address_line,
                        label: `${entry.label} — ${entry.address_line}`,
                      })),
                    ]}
                    onChange={(event) => {
                      const picked = addresses.find((entry) => entry.address_line === event.target.value)
                      setAddress(event.target.value, picked?.latitude ?? null, picked?.longitude ?? null)
                    }}
                  />
                ) : null}

                <TextArea
                  label="Delivery address"
                  placeholder="Flat / building, street, landmark, city"
                  value={address}
                  onChange={(event) => setAddress(event.target.value, latitude, longitude)}
                  error={deliveryType === 'delivery' && !address.trim() ? 'A delivery address is required.' : ''}
                />

                <MapPicker
                  latitude={latitude}
                  longitude={longitude}
                  onPick={(lat, lng) => setAddress(address, lat, lng)}
                  label="Verify your coordinates"
                />

                {belowMinimum ? (
                  <Alert tone="warning" icon="wallet">
                    Minimum order amount from this hotel is {money(hotel?.min_order_amount ?? 0)}. Add{' '}
                    {money((hotel?.min_order_amount ?? 0) - items)} more to unlock home delivery.
                  </Alert>
                ) : null}
              </div>
            ) : (
              <Alert tone="info" icon="store">
                <strong>Collect at the counter</strong>
                {hotel?.place ? `${hotel.name}, ${hotel.place}` : hotel?.name} — please pay when you pick up your order.
              </Alert>
            )}
          </Card>

          <Card className="stack">
            <div className="step-head">
              <span className="step-num">2</span>
              <h3>Payment method</h3>
            </div>

            <label className="radio-row">
              <input type="radio" name="payment" defaultChecked readOnly />
              <span>
                <strong className="small">Cash on delivery / pay at hotel</strong>
                <p className="tiny muted">Hand the exact amount to the courier or at the counter.</p>
              </span>
            </label>

            <label className="radio-row">
              <input type="radio" name="payment" disabled />
              <span>
                <strong className="small">UPI / credit card / online payment</strong>
                <p className="tiny muted">Coming in a future phase.</p>
              </span>
            </label>

            <Alert tone="info" icon="shield">
              🔒 Offline payment only. We currently support Cash on Delivery or payment at the hotel counter.
              Online payment options will be added in a future phase.
            </Alert>
          </Card>

          <Card className="stack">
            <div className="step-head">
              <span className="step-num">3</span>
              <h3>Special instructions</h3>
            </div>
            <TextArea
              placeholder="Allergies, spice level, delivery notes…"
              value={specialInstructions}
              maxLength={400}
              onChange={(event) => setSpecialInstructions(event.target.value)}
            />
          </Card>
        </div>

        <Card className="summary-card stack">
          <h3>Order summary</h3>

          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            {cartItems.map((line) => (
              <div key={line.id} className="row" style={{ gap: 'var(--space-3)' }}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <strong className="small truncate" style={{ display: 'block' }}>{line.name}</strong>
                  <span className="tiny muted">{money(line.price)} each</span>
                </div>
                <QuantityStepper value={line.quantity} onChange={(quantity) => updateQuantity(line.id, quantity)} />
                <span className="small strong nowrap" style={{ width: 62, textAlign: 'right' }}>
                  {money(line.price * line.quantity)}
                </span>
                <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label={`Remove ${line.name}`} onClick={() => removeFromCart(line.id)}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="stack" style={{ gap: 2, paddingTop: 'var(--space-3)', borderTop: '1px dashed var(--border)' }}>
            <div className="summary-line">
              <span className="muted">Scheduled date</span>
              <strong>{scheduledDate ?? '—'}</strong>
            </div>
            <div className="summary-line">
              <span className="muted">Time slot</span>
              <strong>{scheduledTimeSlot ? prettySlot(scheduledTimeSlot) : '—'}</strong>
            </div>
            <div className="summary-line">
              <span className="muted">Subtotal</span>
              <span>{money(items)}</span>
            </div>
            <div className="summary-line">
              <span className="muted">Delivery fee</span>
              <span>{money(deliveryFee)}</span>
            </div>
            <div className="summary-line">
              <span className="muted">Tax (5%)</span>
              <span>{money(tax)}</span>
            </div>
          </div>

          <div className="summary-total">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>

          {missingSchedule ? (
            <Alert tone="warning" icon="calendar">
              Choose a delivery date and time slot before placing the order.
              <Link to={`/hotels/${hotelId}/schedule`} className="link-chip" style={{ marginTop: 6 }}>
                Pick a slot <Icon name="arrowRight" size={13} />
              </Link>
            </Alert>
          ) : null}

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <Button
            variant="primary"
            size="lg"
            block
            loading={submitting}
            disabled={missingSchedule || belowMinimum || (deliveryType === 'delivery' && !address.trim())}
            onClick={() => void placeOrder()}
          >
            {isAuthenticated ? `Place order (offline payment) · ${money(total)}` : 'Register / log in to place order'}
          </Button>
          <p className="tiny muted center">You will pay {money(total)} in cash on delivery or at the counter.</p>
        </Card>
      </div>
    </div>
  )
}
