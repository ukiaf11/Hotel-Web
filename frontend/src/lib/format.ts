const CURRENCY = '$'

export const money = (value: number | string) =>
  `${CURRENCY}${Number(value || 0).toFixed(2)}`

export const todayISO = () => new Date().toLocaleDateString('en-CA')

export const toISODate = (date: Date) => date.toLocaleDateString('en-CA')

export const parseISODate = (value: string) => {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** "13:00-13:30" -> "1:00 PM – 1:30 PM" */
export const prettySlot = (slot: string) => {
  if (!slot) return '—'
  return slot
    .split('-')
    .map((part) => prettyTime(part))
    .join(' – ')
}

export const prettyTime = (value: string) => {
  const [h = '0', m = '00'] = value.split(':')
  const hour = Number(h)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  return `${twelve}:${m.padStart(2, '0')} ${suffix}`
}

export const prettyDate = (value: string, opts: Intl.DateTimeFormatOptions = {}) => {
  const date = value.includes('T') ? new Date(value) : parseISODate(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', ...opts })
}

export const prettyDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export const relativeTime = (value: string) => {
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return prettyDate(value)
}

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?'

export const STATUS_LABEL: Record<string, string> = {
  placed: 'Placed',
  accepted: 'Accepted',
  preparing: 'Preparing',
  out_for_delivery: 'Out for delivery',
  ready_for_pickup: 'Ready for pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const statusTone = (status: string) => {
  if (status === 'completed') return 'badge-open'
  if (status === 'cancelled') return 'badge-closed'
  if (status === 'placed') return 'badge-info'
  return 'badge-warning'
}

export const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export const debounce = <T extends (...args: never[]) => void>(fn: T, wait = 300) => {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}
