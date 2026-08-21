import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Icon } from '../../components/Icons'
import { Alert, Button, Card, EmptyState, Skeleton, TextArea } from '../../components/ui'
import { money, prettySlot, prettyTime, toISODate, todayISO } from '../../lib/format'
import { useCartStore } from '../../store/cart'
import { useActiveHotelStore } from '../../store/hotels'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_DAYS_AHEAD = 14

export function SchedulePage() {
  const { id } = useParams()
  const hotelId = Number(id)
  const navigate = useNavigate()

  const { hotel, isLoading, fetchHotel, slots, slotsLoading, fetchSlots } = useActiveHotelStore()
  const cart = useCartStore()
  const {
    cartItems,
    scheduledDate,
    scheduledTimeSlot,
    specialInstructions,
    setSchedule,
    setSpecialInstructions,
    maxPrepHours,
    subtotal,
  } = cart

  const [month, setMonth] = useState(() => {
    const base = scheduledDate ? new Date(`${scheduledDate}T00:00:00`) : new Date(Date.now())
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(scheduledDate ?? todayISO())

  useEffect(() => {
    if (hotelId && hotel?.id !== hotelId) void fetchHotel(hotelId)
  }, [hotelId, hotel?.id, fetchHotel])

  useEffect(() => {
    if (hotelId && selectedDate) void fetchSlots(hotelId, selectedDate)
  }, [hotelId, selectedDate, fetchSlots])

  const prepHours = maxPrepHours()
  // The clock lives in state and is advanced from an interval so render stays pure
  // and disabled slots re-evaluate as time passes.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const earliest = useMemo(() => new Date(now + prepHours * 3600_000), [now, prepHours])

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + MAX_DAYS_AHEAD)

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null)
    for (let day = 1; day <= total; day += 1) cells.push(new Date(month.getFullYear(), month.getMonth(), day))
    return cells
  }, [month])

  const slotRows = useMemo(() => {
    if (!slots) return []
    return slots.booked_slots_capacity.map((slot) => {
      const [hour, minute] = slot.start.split(':').map(Number)
      const when = new Date(`${selectedDate}T00:00:00`)
      when.setHours(hour, minute, 0, 0)
      const tooSoon = when.getTime() < earliest.getTime()
      return { ...slot, when, disabled: slot.is_past || slot.is_full || !slot.is_enabled || tooSoon, tooSoon }
    })
  }, [slots, selectedDate, earliest])

  const firstAvailable = slotRows.find((slot) => !slot.disabled)
  const leadBlocked = prepHours > 0 && slotRows.some((slot) => slot.tooSoon && !slot.is_past)

  if (!cartItems.length) {
    return (
      <div className="shell section">
        <EmptyState
          icon="cart"
          title="Your cart is empty"
          body="Add a few dishes from a hotel menu before choosing a delivery slot."
          action={<Button variant="primary" onClick={() => navigate('/')}>Browse hotels</Button>}
        />
      </div>
    )
  }

  return (
    <div className="shell section">
      <Link to={`/hotels/${hotelId}`} className="link-chip" style={{ marginBottom: 'var(--space-4)' }}>
        <Icon name="arrowLeft" size={14} /> Back to hotel menu
      </Link>

      <div className="page-title">
        <h1>Schedule your order</h1>
        <p className="soft">Pick the day and 30-minute window that suits you. {hotel ? `${hotel.name} prepares orders between ${prettyTime(hotel.opening_time)} and ${prettyTime(hotel.closing_time)}.` : ''}</p>
      </div>

      <div className="schedule-grid">
        <div className="stack" style={{ gap: 'var(--space-5)' }}>
          <Card className="stack">
            <div className="step-head">
              <span className="step-num">1</span>
              <h3>Select a date</h3>
            </div>

            <div className="calendar-head">
              <Button
                size="sm"
                variant="ghost"
                icon="chevronLeft"
                aria-label="Previous month"
                disabled={month <= new Date(today.getFullYear(), today.getMonth(), 1)}
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              >
                Prev
              </Button>
              <strong>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
              <Button
                size="sm"
                variant="ghost"
                iconRight="chevronRight"
                aria-label="Next month"
                disabled={new Date(month.getFullYear(), month.getMonth() + 1, 1) > horizon}
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              >
                Next
              </Button>
            </div>

            <div className="calendar">
              {DOW.map((label) => (
                <span key={label} className="dow">{label}</span>
              ))}
              {days.map((day, index) => {
                if (!day) return <span key={`blank-${index}`} className="day blank" />
                const iso = toISODate(day)
                const outOfRange = day < today || day > horizon
                return (
                  <button
                    key={iso}
                    className={`day ${iso === selectedDate ? 'selected' : ''} ${iso === todayISO() ? 'today' : ''}`}
                    disabled={outOfRange}
                    aria-pressed={iso === selectedDate}
                    aria-label={day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                    onClick={() => setSelectedDate(iso)}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>
            <p className="tiny muted">Scheduling is limited to {MAX_DAYS_AHEAD} days ahead to keep kitchen operations predictable.</p>
          </Card>

          <Card className="stack">
            <div className="step-head">
              <span className="step-num">2</span>
              <h3>Select a time slot</h3>
            </div>

            {leadBlocked ? (
              <Alert tone="info" icon="sparkle">
                💡 Earliest available slot is{' '}
                <strong>{firstAvailable ? prettyTime(firstAvailable.start) : 'on a later date'}</strong> because your cart
                contains items requiring {prepHours} hour{prepHours === 1 ? '' : 's'} of advance preparation.
              </Alert>
            ) : null}

            {slotsLoading ? (
              <div className="slot-grid">
                {Array.from({ length: 12 }, (_, index) => (
                  <Skeleton key={index} height={42} />
                ))}
              </div>
            ) : slotRows.length ? (
              <div className="slot-grid" role="group" aria-label="Available time slots">
                {slotRows.map((slot) => (
                  <button
                    key={slot.slot}
                    className={`slot ${scheduledTimeSlot === slot.slot && scheduledDate === selectedDate ? 'selected' : ''}`}
                    disabled={slot.disabled}
                    aria-pressed={scheduledTimeSlot === slot.slot}
                    title={
                      slot.is_full
                        ? 'This slot is fully booked'
                        : !slot.is_enabled
                          ? 'The hotel does not deliver in this block'
                          : slot.tooSoon
                            ? 'Too soon for the preparation lead time in your cart'
                            : undefined
                    }
                    onClick={() => setSchedule(selectedDate, slot.slot)}
                  >
                    {scheduledTimeSlot === slot.slot && scheduledDate === selectedDate ? <Icon name="check" size={13} /> : null}
                    {prettySlot(slot.slot)}
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState icon="clock" title="No slots on this date" body="The kitchen is closed on the selected day. Try another date." />
            )}
          </Card>

          <Card className="stack">
            <div className="step-head">
              <span className="step-num">3</span>
              <h3>Special instructions</h3>
            </div>
            <TextArea
              label="Delivery notes or allergy information (optional)"
              placeholder="e.g. Ring the bell twice, no peanuts, mild spice…"
              value={specialInstructions}
              maxLength={400}
              onChange={(event) => setSpecialInstructions(event.target.value)}
              hint={`${specialInstructions.length}/400 characters`}
            />
          </Card>
        </div>

        <Card className="summary-card stack">
          <h3>Order summary</h3>
          {isLoading ? <Skeleton height={18} width="60%" /> : <p className="small muted">{hotel?.name}</p>}

          <div className="stack" style={{ gap: 2 }}>
            {cartItems.map((line) => (
              <div key={line.id} className="summary-line">
                <span className="truncate">
                  {line.name} <span className="muted">×{line.quantity}</span>
                </span>
                <span className="nowrap">{money(line.price * line.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="summary-total">
            <span>Subtotal</span>
            <span>{money(subtotal())}</span>
          </div>

          <div className="stack" style={{ gap: 'var(--space-2)', paddingTop: 'var(--space-3)', borderTop: '1px dashed var(--border)' }}>
            <div className="summary-line">
              <span className="muted">Date</span>
              <strong>{scheduledDate ?? '—'}</strong>
            </div>
            <div className="summary-line">
              <span className="muted">Time slot</span>
              <strong>{scheduledTimeSlot ? prettySlot(scheduledTimeSlot) : '—'}</strong>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            block
            iconRight="arrowRight"
            disabled={!scheduledDate || !scheduledTimeSlot}
            onClick={() => navigate('/checkout')}
          >
            Proceed to checkout · {money(subtotal())}
          </Button>
          {!scheduledTimeSlot ? <p className="tiny muted center">Pick a time slot to continue.</p> : null}
        </Card>
      </div>
    </div>
  )
}
