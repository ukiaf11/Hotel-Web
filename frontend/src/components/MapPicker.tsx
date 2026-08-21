import { useState } from 'react'

import { Icon } from './Icons'
import { Button } from './ui'

interface Props {
  latitude: number | null
  longitude: number | null
  onPick: (lat: number, lng: number) => void
  label?: string
  searchable?: boolean
}

/**
 * Coordinate picker. Uses the browser geolocation API for "use my location" and lets
 * the user drop a pin by clicking the grid; the resolved coordinates open in Google Maps.
 * No API key required, so it works on the free deployment.
 */
export function MapPicker({ latitude, longitude, onPick, label = 'Pin location on map', searchable = false }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const locate = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.')
      return
    }
    setBusy(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onPick(Number(position.coords.latitude.toFixed(6)), Number(position.coords.longitude.toFixed(6)))
        setBusy(false)
      },
      () => {
        setError('Location permission denied. Click the map to drop a pin manually.')
        setBusy(false)
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const dropPin = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    // Anchor the synthetic pin around the current point (or a city default) so the
    // demo produces plausible, distinct coordinates.
    const baseLat = latitude ?? 19.076
    const baseLng = longitude ?? 72.8777
    onPick(Number((baseLat + (0.5 - y) * 0.06).toFixed(6)), Number((baseLng + (x - 0.5) * 0.06).toFixed(6)))
  }

  const hasPin = latitude != null && longitude != null
  const mapsHref = hasPin
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || 'restaurants near me')}`

  return (
    <div className="stack" style={{ gap: 'var(--space-2)' }}>
      <span className="field-label">{label}</span>
      {searchable ? (
        <input
          className="form-input"
          placeholder="Search an address to centre the map…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      ) : null}

      <div
        className="map-preview"
        onClick={dropPin}
        role="button"
        tabIndex={0}
        aria-label="Click to drop a location pin"
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') locate()
        }}
      >
        <span className="map-pin">
          <Icon name="pin" size={hasPin ? 34 : 26} filled={hasPin} strokeWidth={hasPin ? 0 : 2} />
        </span>
      </div>

      <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
        <Button size="sm" icon="pin" loading={busy} onClick={locate} type="button">
          Use my location
        </Button>
        <a className="btn btn-ghost btn-sm" href={mapsHref} target="_blank" rel="noreferrer">
          <Icon name="external" size={14} />
          Open in Google Maps
        </a>
        <span className="tiny muted mono">
          {hasPin ? `${latitude?.toFixed(4)}, ${longitude?.toFixed(4)}` : 'No pin dropped yet'}
        </span>
      </div>
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  )
}
