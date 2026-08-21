import { useEffect, useState } from 'react'

import { Alert, Button, Card, Skeleton, TextInput, Toggle } from '../../components/ui'
import { money } from '../../lib/format'
import { useSyncedState } from '../../hooks/useSyncedState'
import type { DeliveryConfig } from '../../lib/types'
import { errorMessage } from '../../services/errors'
import { useDeliverySettingsStore } from '../../store/distributor'
import { useUIStore } from '../../store/ui'

const BLOCKS = [
  { key: 'morning' as const, label: 'Morning', window: '09:00 – 12:00' },
  { key: 'afternoon' as const, label: 'Afternoon', window: '12:00 – 17:00' },
  { key: 'evening' as const, label: 'Evening', window: '17:00 – 22:00' },
]

export function DeliveryPage() {
  const { config, isLoading, error, fetchSettings, saveSettings } = useDeliverySettingsStore()
  const toast = useUIStore((state) => state.toast)
  const [form, setForm] = useSyncedState(config, (value) => value)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  if (isLoading || !form) return <Skeleton height={400} />

  const set = <K extends keyof DeliveryConfig>(key: K, value: DeliveryConfig[K]) =>
    setForm((state) => (state ? { ...state, [key]: value } : state))

  const save = async () => {
    setSaving(true)
    try {
      await saveSettings(form)
      toast('success', 'Delivery parameters updated', 'Customer checkout reflects the new rules immediately.')
    } catch (saveError) {
      toast('error', 'Could not save', errorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  const noSlots = !form.active_slots.morning && !form.active_slots.afternoon && !form.active_slots.evening

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card className="stack">
        <div className="panel-title">
          <h3>Home delivery mode</h3>
        </div>
        <Toggle
          checked={form.has_delivery}
          onChange={(has_delivery) => set('has_delivery', has_delivery)}
          label="Enable home delivery for customers"
          brand
        />
        <p className="small muted">
          When this is off, the hotel details page shows an amber “self-pickup only” notice and the
          delivery option is disabled at checkout.
        </p>
      </Card>

      <div
        className="stack"
        style={{
          gap: 'var(--space-5)',
          opacity: form.has_delivery ? 1 : 0.4,
          pointerEvents: form.has_delivery ? 'auto' : 'none',
          transition: 'opacity var(--speed) var(--ease)',
        }}
        aria-hidden={!form.has_delivery}
      >
        <Card className="stack">
          <div className="panel-title">
            <h3>Pricing &amp; boundaries</h3>
          </div>
          <div className="split-3">
            <TextInput
              label="Minimum order amount"
              type="number"
              min={0}
              step={0.5}
              value={form.min_order_amount}
              hint="Checkout blocks delivery below this subtotal."
              onChange={(event) => set('min_order_amount', Number(event.target.value))}
            />
            <TextInput
              label="Flat delivery fee"
              type="number"
              min={0}
              step={0.5}
              value={form.flat_delivery_fee}
              hint="Added to the customer summary."
              onChange={(event) => set('flat_delivery_fee', Number(event.target.value))}
            />
            <TextInput
              label="Average delivery time (minutes)"
              type="number"
              min={5}
              max={180}
              value={form.avg_delivery_minutes}
              hint="Under 30 min qualifies for the “Fast delivery” filter."
              onChange={(event) => set('avg_delivery_minutes', Number(event.target.value))}
            />
          </div>

          <div className="field">
            <span className="field-label">Delivery radius — {form.delivery_radius_km} km</span>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={form.delivery_radius_km}
              style={{ accentColor: 'var(--brand-primary)' }}
              onChange={(event) => set('delivery_radius_km', Number(event.target.value))}
            />
            <span className="field-hint">
              Orders are rejected when the customer’s pinned coordinates fall outside this boundary.
            </span>
          </div>

          <Alert tone="info" icon="wallet">
            A {money(form.flat_delivery_fee)} fee applies on orders above {money(form.min_order_amount)} within{' '}
            {form.delivery_radius_km} km, typically delivered in {form.avg_delivery_minutes} minutes.
          </Alert>
        </Card>

        <Card className="stack">
          <div className="panel-title">
            <h3>Delivery slot blocks</h3>
          </div>
          <p className="small muted">Unchecking a block removes those 30-minute slots from the customer scheduling grid.</p>
          <div className="split-3">
            {BLOCKS.map((block) => (
              <Card key={block.key} className="stack" style={{ background: 'var(--surface-sunken)' }}>
                <Toggle
                  checked={form.active_slots[block.key]}
                  onChange={(checked) => set('active_slots', { ...form.active_slots, [block.key]: checked })}
                  label={block.label}
                />
                <span className="tiny muted mono">{block.window}</span>
              </Card>
            ))}
          </div>
          {noSlots ? (
            <Alert tone="warning" icon="warning">
              Every delivery block is switched off — customers will not find any bookable slot.
            </Alert>
          ) : null}
        </Card>
      </div>

      <Button variant="primary" size="lg" icon="check" loading={saving} onClick={() => void save()} style={{ width: 'fit-content' }}>
        Save logistics configuration
      </Button>
    </div>
  )
}
