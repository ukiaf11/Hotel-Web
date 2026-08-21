import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Icon } from '../../components/Icons'
import { Alert, Badge, Button, Card, EmptyState, QuantityStepper, Skeleton } from '../../components/ui'
import { money, prettyTime } from '../../lib/format'
import type { FoodItem } from '../../lib/types'
import { useCartStore } from '../../store/cart'
import { useActiveHotelStore } from '../../store/hotels'
import { useUIStore } from '../../store/ui'

function FoodCard({ item, disabled }: { item: FoodItem; disabled: boolean }) {
  const { cartItems, addToCart, updateQuantity, hotelId } = useCartStore()
  const hotel = useActiveHotelStore((state) => state.hotel)
  const toast = useUIStore((state) => state.toast)

  const line = hotelId === hotel?.id ? cartItems.find((entry) => entry.id === item.id) : undefined

  const add = () => {
    if (!hotel) return
    const switching = hotelId !== null && hotelId !== hotel.id
    addToCart(item, hotel)
    toast('success', `${item.name} added`, switching ? 'Your previous cart was from another hotel and has been replaced.' : undefined)
  }

  return (
    <article className={`food-card ${item.is_available ? '' : 'unavailable'}`}>
      {item.image ? (
        <img className="food-thumb" src={item.image} alt="" loading="lazy" />
      ) : (
        <div className="food-thumb center">
          <Icon name="utensils" size={22} />
        </div>
      )}

      <div className="food-body">
        <div className="food-title">
          <span className={`veg-mark ${item.is_veg ? '' : 'nonveg'}`} aria-label={item.is_veg ? 'Vegetarian' : 'Non-vegetarian'} />
          <strong className="truncate">{item.name}</strong>
        </div>
        {item.description ? <p className="tiny muted">{item.description}</p> : null}

        {item.is_custom_order ? (
          <Badge tone="badge-warning" icon="clock">
            On-order · needs {item.preparation_time_hours} hr{item.preparation_time_hours === 1 ? '' : 's'} notice
          </Badge>
        ) : (
          <Badge tone="badge-open" icon="fire">
            Instant item
          </Badge>
        )}

        <div className="food-foot">
          <span className="price">{money(item.price)}</span>
          {!item.is_available ? (
            <Badge tone="badge-closed">Out of stock</Badge>
          ) : line ? (
            <QuantityStepper value={line.quantity} onChange={(quantity) => updateQuantity(item.id, quantity)} />
          ) : (
            <Button size="sm" variant="primary" icon="plus" disabled={disabled} onClick={add}>
              Add
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

export function HotelDetailsPage() {
  const { id } = useParams()
  const hotelId = Number(id)
  const navigate = useNavigate()
  const { hotel, items, categories, isLoading, error, fetchHotel } = useActiveHotelStore()
  const { cartItems, hotelId: cartHotelId, subtotal, totalItems } = useCartStore()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  useEffect(() => {
    if (hotelId) void fetchHotel(hotelId)
  }, [hotelId, fetchHotel])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => !query || item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query))
  }, [items, search])

  const grouped = useMemo(() => {
    const map = new Map<string, FoodItem[]>()
    filtered.forEach((item) => map.set(item.category, [...(map.get(item.category) ?? []), item]))
    return [...map.entries()]
  }, [filtered])

  const cartCount = cartHotelId === hotelId ? totalItems() : 0

  const jump = (category: string) => {
    setActiveCategory(category)
    if (category === 'all') {
      window.scrollTo({ top: 320, behavior: 'smooth' })
      return
    }
    document.getElementById(`cat-${category.replace(/\s+/g, '-')}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (isLoading) {
    return (
      <div className="shell section stack">
        <Skeleton height={300} radius={22} />
        <div className="item-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} height={116} />
          ))}
        </div>
      </div>
    )
  }

  if (error || !hotel) {
    return (
      <div className="shell section">
        <EmptyState
          icon="store"
          title="Hotel unavailable"
          body={error || 'This hotel could not be found, or it has not been verified yet.'}
          action={<Button variant="primary" onClick={() => navigate('/')}>Back to home feed</Button>}
        />
      </div>
    )
  }

  return (
    <>
      <div className="shell section">
        <Link to="/" className="link-chip" style={{ marginBottom: 'var(--space-4)' }}>
          <Icon name="arrowLeft" size={14} /> Back to all hotels
        </Link>

        <section className="hotel-hero">
          {hotel.banner_image ? <img src={hotel.banner_image} alt="" /> : null}
          <div className="hotel-hero-body">
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              <div className="row wrap">
                <Badge tone={hotel.is_open ? 'badge-open' : 'badge-closed'}>
                  <span className="dot" />
                  {hotel.is_open ? 'Open now' : 'Closed'}
                </Badge>
                {hotel.rating > 0 ? (
                  <Badge tone="badge-warning" icon="star">
                    {hotel.rating.toFixed(1)} · {hotel.rating_count} reviews
                  </Badge>
                ) : null}
              </div>
              <h1>{hotel.name}</h1>
              <span className="hotel-meta">
                <Icon name="pin" size={15} />
                {hotel.place || 'Location not set'}
              </span>
              <span className="hotel-meta">
                <Icon name="clock" size={15} />
                {prettyTime(hotel.opening_time)} – {prettyTime(hotel.closing_time)}
              </span>
            </div>

            <div className="hero-cta">
              {hotel.contact_number ? (
                <a className="btn" href={`tel:${hotel.contact_number}`}>
                  <Icon name="phone" size={15} />
                  {hotel.contact_number}
                </a>
              ) : null}
              <a className="btn" href={hotel.google_map_url} target="_blank" rel="noreferrer">
                <Icon name="pin" size={15} />
                View on Google Maps
              </a>
            </div>
          </div>
        </section>
      </div>

      <div className="category-bar">
        <div className="shell row-between wrap" style={{ width: '100%' }}>
          <div className="pill-group">
            <button className="pill" aria-pressed={activeCategory === 'all'} onClick={() => jump('all')}>
              All items
            </button>
            {categories.map((category) => (
              <button key={category} className="pill" aria-pressed={activeCategory === category} onClick={() => jump(category)}>
                {category}
              </button>
            ))}
          </div>
          <div className="input-with-icon" style={{ maxWidth: 260, flex: '1 1 200px' }}>
            <Icon name="search" size={15} />
            <input
              className="form-input"
              placeholder="Search this menu…"
              value={search}
              aria-label="Search menu items"
              onChange={(event) => setSearch(event.target.value)}
            />
            {search ? (
              <button className="input-clear" onClick={() => setSearch('')} aria-label="Clear menu search">
                <Icon name="close" size={14} />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="shell section">
        <div className="menu-layout">
          <div>
            {grouped.length ? (
              grouped.map(([category, list]) => (
                <section key={category} className="menu-section">
                  <h3 id={`cat-${category.replace(/\s+/g, '-')}`}>
                    {category} <span className="small muted">({list.length})</span>
                  </h3>
                  <div className="item-grid">
                    {list.map((item) => (
                      <FoodCard key={item.id} item={item} disabled={!hotel.is_open} />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <EmptyState icon="utensils" title="No dishes match that search" body="Try another keyword or browse a different category." />
            )}
          </div>

          <aside className="menu-aside">
            {hotel.has_delivery ? (
              <Alert tone="success" icon="truck">
                <strong>Home delivery is available</strong>
                Delivery charges apply ({money(hotel.flat_delivery_fee)} flat fee
                {hotel.min_order_amount > 0 ? `, ${money(hotel.min_order_amount)} minimum order` : ''}). Typical
                delivery time {hotel.avg_delivery_minutes} minutes within {hotel.delivery_radius_km} km.
              </Alert>
            ) : (
              <Alert tone="warning" icon="warning">
                <strong>Home delivery is NOT available for this hotel</strong>
                All items must be collected via self-pickup at the counter.
              </Alert>
            )}

            {!hotel.is_open ? (
              <Alert tone="danger" icon="clock">
                <strong>This hotel is currently closed</strong>
                You can still browse the menu — ordering reopens at {prettyTime(hotel.opening_time)}.
              </Alert>
            ) : null}

            <Card className="stack">
              <div className="row-between">
                <strong>Your cart</strong>
                <Badge tone="badge-brand">{cartCount} item{cartCount === 1 ? '' : 's'}</Badge>
              </div>
              {cartCount ? (
                <>
                  <div className="stack" style={{ gap: 'var(--space-1)' }}>
                    {cartItems.map((line) => (
                      <div key={line.id} className="summary-line">
                        <span className="truncate">
                          {line.name} <span className="muted">×{line.quantity}</span>
                        </span>
                        <span className="nowrap strong">{money(line.price * line.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="summary-total">
                    <span>Subtotal</span>
                    <span>{money(subtotal())}</span>
                  </div>
                  <Button variant="primary" block iconRight="arrowRight" onClick={() => navigate(`/hotels/${hotel.id}/schedule`)}>
                    Schedule this order
                  </Button>
                </>
              ) : (
                <p className="small muted">Add dishes from the menu to start an order.</p>
              )}
            </Card>

            {hotel.description ? (
              <Card className="stack">
                <strong className="small">About</strong>
                <p className="small muted">{hotel.description}</p>
              </Card>
            ) : null}
          </aside>
        </div>
      </div>
    </>
  )
}
