import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Icon } from '../../components/Icons'
import { Alert, Badge, Button, EmptyState, Pills, Skeleton } from '../../components/ui'
import { money, STATUS_LABEL } from '../../lib/format'
import type { Hotel } from '../../lib/types'
import { useAuthStore } from '../../store/auth'
import { HOME_FILTERS, useHotelStore } from '../../store/hotels'
import { useActiveOrderStore } from '../../store/orders'

function HotelCard({ hotel }: { hotel: Hotel }) {
  const navigate = useNavigate()
  return (
    <article
      className="hotel-card"
      onClick={() => navigate(`/hotels/${hotel.id}`)}
      role="link"
      tabIndex={0}
      aria-label={`${hotel.name}, ${hotel.place}`}
      onKeyDown={(event) => {
        if (event.key === 'Enter') navigate(`/hotels/${hotel.id}`)
      }}
    >
      <div className="hotel-media">
        {hotel.banner_image ? (
          <img src={hotel.banner_image} alt="" loading="lazy" />
        ) : (
          <div className="center grow" style={{ height: '100%' }}>
            <Icon name="store" size={34} />
          </div>
        )}
        <Badge tone={hotel.is_open ? 'badge-open' : 'badge-closed'}>
          <span className="dot" />
          {hotel.is_open ? 'Open now' : 'Closed'}
        </Badge>
        {hotel.rating > 0 ? (
          <span className="badge rating-chip">
            <Icon name="star" size={12} filled strokeWidth={0} />
            {hotel.rating.toFixed(1)} ({hotel.rating_count})
          </span>
        ) : null}
      </div>

      <div className="hotel-body">
        <h3 className="truncate">{hotel.name}</h3>
        {hotel.cuisine ? <span className="tiny muted">{hotel.cuisine}</span> : null}

        <span className="hotel-meta">
          <Icon name="pin" size={14} />
          <span className="truncate">{hotel.place || 'Location not set'}</span>
        </span>

        <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
          <Badge tone={hotel.has_delivery ? 'badge-info' : ''} icon={hotel.has_delivery ? 'truck' : 'store'}>
            {hotel.has_delivery ? `Delivery ~${hotel.avg_delivery_minutes} min` : 'Self-pickup only'}
          </Badge>
        </div>

        <div className="hotel-foot">
          {hotel.contact_number ? (
            <a
              className="link-chip"
              href={`tel:${hotel.contact_number}`}
              onClick={(event) => event.stopPropagation()}
            >
              <Icon name="phone" size={13} />
              {hotel.contact_number}
            </a>
          ) : (
            <span />
          )}
          <a
            className="link-chip"
            href={hotel.google_map_url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            <Icon name="pin" size={13} />
            View map
          </a>
        </div>
      </div>
    </article>
  )
}

function CardSkeleton() {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <Skeleton height={172} radius={0} />
      <div className="stack" style={{ padding: 'var(--space-4)', gap: 'var(--space-2)' }}>
        <Skeleton height={20} width="70%" />
        <Skeleton height={14} width="45%" />
        <Skeleton height={14} width="60%" />
        <Skeleton height={30} />
      </div>
    </div>
  )
}

export function HomePage() {
  const { hotels, isLoading, error, searchQuery, activeFilter, fetchHotels, setSearchQuery, setActiveFilter } = useHotelStore()
  const { isAuthenticated } = useAuthStore()
  const { activeOrders, fetchActive } = useActiveOrderStore()
  const [draft, setDraft] = useState(searchQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    void fetchHotels()
  }, [fetchHotels])

  useEffect(() => {
    if (isAuthenticated) void fetchActive()
  }, [isAuthenticated, fetchActive])

  // 300 ms debounce before the search hits the API (doc 01).
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (draft === searchQuery) return
    debounceRef.current = setTimeout(() => setSearchQuery(draft), 300)
    return () => clearTimeout(debounceRef.current)
  }, [draft, searchQuery, setSearchQuery])

  const stats = useMemo(
    () => ({
      hotels: hotels.length,
      open: hotels.filter((hotel) => hotel.is_open).length,
      delivering: hotels.filter((hotel) => hotel.has_delivery).length,
    }),
    [hotels],
  )

  const tracked = activeOrders[0]

  return (
    <>
      <section className="hero">
        <div className="shell hero-inner">
          <span className="badge badge-brand" style={{ width: 'fit-content' }}>
            <Icon name="sparkle" size={13} />
            Schedule meals up to 14 days ahead
          </span>
          <h1>
            Find the best <em>hotels &amp; meals</em> near you
          </h1>
          <p>
            Browse verified neighbourhood kitchens, pick a delivery or pickup slot that fits your day,
            and pay offline when your food arrives.
          </p>

          <div className="search-bar" role="search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={draft}
              placeholder="Search hotels, cuisines, or dishes…"
              aria-label="Search hotels, cuisines, or dishes"
              onChange={(event) => setDraft(event.target.value)}
            />
            {draft ? (
              <button className="input-clear" style={{ position: 'static' }} onClick={() => setDraft('')} aria-label="Clear search">
                <Icon name="close" size={16} />
              </button>
            ) : null}
            <Button variant="primary" onClick={() => setSearchQuery(draft)}>
              Search
            </Button>
          </div>

          <div className="hero-stats">
            <div>
              <b>{stats.hotels}</b>
              <span className="tiny muted">Verified hotels</span>
            </div>
            <div>
              <b>{stats.open}</b>
              <span className="tiny muted">Open right now</span>
            </div>
            <div>
              <b>{stats.delivering}</b>
              <span className="tiny muted">Offering delivery</span>
            </div>
          </div>
        </div>
      </section>

      <section className="shell section">
        <div className="row-between wrap" style={{ marginBottom: 'var(--space-4)' }}>
          <Pills options={HOME_FILTERS.map((filter) => ({ key: filter.key, label: filter.label }))} value={activeFilter} onChange={setActiveFilter} />
          <span className="small muted nowrap">
            {isLoading ? 'Loading…' : `${hotels.length} result${hotels.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {error ? (
          <Alert tone="danger">
            <strong>Could not load hotels</strong>
            {error}
            <Button size="sm" variant="ghost" icon="refresh" onClick={() => void fetchHotels()} style={{ marginTop: 8 }}>
              Retry
            </Button>
          </Alert>
        ) : isLoading ? (
          <div className="hotel-grid">
            {Array.from({ length: 6 }, (_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
        ) : hotels.length ? (
          <div className="hotel-grid">
            {hotels.map((hotel, index) => (
              <div key={hotel.id} className="animate-in" style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}>
                <HotelCard hotel={hotel} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="search"
            title="No hotels match your search"
            body="Try a different keyword, or clear the filters to see every verified kitchen."
            action={
              <Button
                variant="soft"
                onClick={() => {
                  setDraft('')
                  setSearchQuery('')
                  setActiveFilter('all')
                }}
              >
                Reset filters
              </Button>
            }
          />
        )}
      </section>

      {tracked ? (
        <Link to={`/orders/track/${tracked.order_id}`} className="active-banner">
          <span className={`badge ${tracked.status === 'out_for_delivery' ? 'badge-open' : 'badge-warning'}`}>
            <span className="dot dot-pulse" />
          </span>
          <span className="grow">
            <strong className="small" style={{ display: 'block' }}>
              Order #{tracked.order_id} · {STATUS_LABEL[tracked.status]}
            </strong>
            <span className="tiny muted">
              {tracked.hotel_name} · {money(tracked.total_amount)} · Tap to track
            </span>
          </span>
          <Icon name="chevronRight" size={18} />
        </Link>
      ) : null}
    </>
  )
}
