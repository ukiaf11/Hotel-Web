import { useEffect, useMemo, useState } from 'react'

import { Icon } from '../../components/Icons'
import { SalesChart } from '../../components/SalesChart'
import { Alert, Badge, Button, Card, EmptyState, Select, Skeleton, Stars, TextInput } from '../../components/ui'
import { downloadBlob, money, prettyDate, toISODate, todayISO } from '../../lib/format'
import type { TopItem } from '../../lib/types'
import { api } from '../../services/api'
import { errorMessage } from '../../services/errors'
import { useDistributorReportsStore } from '../../store/distributor'
import { useUIStore } from '../../store/ui'

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom range' },
]

const rangeFor = (preset: string): { start: string; end: string } => {
  const today = new Date()
  const iso = (date: Date) => toISODate(date)
  if (preset === 'today') return { start: iso(today), end: iso(today) }
  if (preset === 'yesterday') {
    const day = new Date(today)
    day.setDate(day.getDate() - 1)
    return { start: iso(day), end: iso(day) }
  }
  if (preset === 'month') {
    return { start: iso(new Date(today.getFullYear(), today.getMonth(), 1)), end: iso(today) }
  }
  const days = Number(preset) || 7
  const start = new Date(today)
  start.setDate(start.getDate() - (days - 1))
  return { start: iso(start), end: iso(today) }
}

type SortKey = keyof Pick<TopItem, 'name' | 'qty_sold' | 'revenue' | 'rating'>

export function ReportsPage() {
  const { report, isLoading, error, fetchAnalytics } = useDistributorReportsStore()
  const toast = useUIStore((state) => state.toast)

  const [preset, setPreset] = useState('7')
  const [range, setRange] = useState(rangeFor('7'))
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'revenue', asc: false })
  const [exporting, setExporting] = useState('')

  useEffect(() => {
    void fetchAnalytics(range.start, range.end)
  }, [range, fetchAnalytics])

  const applyPreset = (value: string) => {
    setPreset(value)
    if (value !== 'custom') setRange(rangeFor(value))
  }

  const sorted = useMemo(() => {
    if (!report) return []
    return [...report.top_items].sort((a, b) => {
      const left = a[sort.key]
      const right = b[sort.key]
      const compare = typeof left === 'string' ? left.localeCompare(String(right)) : Number(left) - Number(right)
      return sort.asc ? compare : -compare
    })
  }, [report, sort])

  const exportReport = async (format: 'csv' | 'pdf') => {
    setExporting(format)
    try {
      const blob = await api.blob(`/distributor/orders/reports/export/?start_date=${range.start}&end_date=${range.end}&format=${format}`)
      downloadBlob(blob, `sales-${range.start}-to-${range.end}.${format}`)
      toast('success', `${format.toUpperCase()} exported`)
    } catch (exportError) {
      toast('error', 'Export failed', errorMessage(exportError))
    } finally {
      setExporting('')
    }
  }

  const header = (key: SortKey, label: string) => (
    <th>
      <button onClick={() => setSort({ key, asc: sort.key === key ? !sort.asc : false })}>
        {label}
        {sort.key === key ? <Icon name={sort.asc ? 'chevronDown' : 'chevronDown'} size={12} className={sort.asc ? '' : ''} /> : null}
      </button>
    </th>
  )

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <Card className="stack">
        <div className="panel-title">
          <h3>Sales analytics</h3>
          <div className="row wrap">
            <Button size="sm" variant="secondary" icon="download" loading={exporting === 'csv'} onClick={() => void exportReport('csv')}>
              Export CSV
            </Button>
            <Button size="sm" variant="secondary" icon="download" loading={exporting === 'pdf'} onClick={() => void exportReport('pdf')}>
              Export PDF
            </Button>
          </div>
        </div>

        <div className="row wrap" style={{ gap: 'var(--space-3)', alignItems: 'flex-end' }}>
          <div style={{ minWidth: 180 }}>
            <Select label="Range" value={preset} options={PRESETS} onChange={(event) => applyPreset(event.target.value)} />
          </div>
          {preset === 'custom' ? (
            <>
              <TextInput label="From" type="date" max={todayISO()} value={range.start} onChange={(event) => setRange({ ...range, start: event.target.value })} />
              <TextInput label="To" type="date" max={todayISO()} value={range.end} onChange={(event) => setRange({ ...range, end: event.target.value })} />
            </>
          ) : (
            <span className="small muted">
              {prettyDate(range.start)} → {prettyDate(range.end)}
            </span>
          )}
        </div>
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-label">Total sales</span>
          <span className="kpi-value">{isLoading || !report ? <Skeleton height={30} width={100} /> : money(report.total_sales)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Total orders</span>
          <span className="kpi-value">{isLoading || !report ? <Skeleton height={30} width={60} /> : report.total_orders}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Average ticket</span>
          <span className="kpi-value">{isLoading || !report ? <Skeleton height={30} width={90} /> : money(report.avg_order_value)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Peak day</span>
          <span className="kpi-value" style={{ fontSize: 'var(--text-xl)' }}>
            {isLoading || !report ? (
              <Skeleton height={26} width={110} />
            ) : report.daily_series.length ? (
              prettyDate([...report.daily_series].sort((a, b) => b.sales - a.sales)[0].date, { year: undefined })
            ) : (
              '—'
            )}
          </span>
        </div>
      </div>

      <Card className="stack">
        <div className="panel-title">
          <h3>Sales performance curve</h3>
        </div>
        {isLoading || !report ? (
          <Skeleton height={220} />
        ) : (
          <SalesChart
            data={report.daily_series.map((row) => ({ label: row.date.slice(5), value: row.sales }))}
            type="line"
            ariaLabel="Daily revenue across the selected range"
          />
        )}
      </Card>

      <Card className="stack">
        <div className="panel-title">
          <h3>Top performing menu items</h3>
          {report ? <Badge>{report.top_items.length} items</Badge> : null}
        </div>

        {isLoading ? (
          <Skeleton height={180} />
        ) : sorted.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {header('name', 'Item')}
                  {header('qty_sold', 'Units sold')}
                  {header('revenue', 'Revenue')}
                  {header('rating', 'Rating')}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.name}>
                    <td>
                      <strong>{row.name}</strong>
                    </td>
                    <td>{row.qty_sold} units</td>
                    <td>
                      <strong>{money(row.revenue)}</strong>
                    </td>
                    <td>{row.rating ? <span className="row" style={{ gap: 6 }}><Stars value={row.rating} size={12} />{row.rating.toFixed(1)}</span> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="chart" title="No completed orders in this range" body="Pick a wider date range, or complete a few orders to populate the analytics." />
        )}
      </Card>
    </div>
  )
}
