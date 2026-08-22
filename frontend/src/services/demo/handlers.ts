/**
 * Demo backend: a faithful in-browser implementation of the Django API surface.
 * Used whenever `VITE_API_URL` is not configured, which is how the public demo runs.
 */

import { ApiError } from '../errors'
import type { DeliveryType, OrderStatus, Role } from '../../lib/types'
import {
  getDb,
  nextId,
  priceLines,
  save,
  type DemoAddress,
  type DemoHotel,
  type DemoItem,
  type DemoNotification,
  type DemoOrder,
  type DemoUser,
} from './db'
import { EMAILJS_CONFIGURED, sendOrderEmails } from './email'
import { PAGE, PdfDoc } from './pdf'

const PAGE_SIZE = 6
const ACTIVE: OrderStatus[] = ['placed', 'accepted', 'preparing', 'out_for_delivery', 'ready_for_pickup']
const STAFF_ROLES: Role[] = ['manager', 'cook', 'courier']
const DISTRIBUTOR_SIDE: Role[] = ['distributor', ...STAFF_ROLES]

const SLOT_BLOCKS: [keyof DemoHotel['slots'], number, number][] = [
  ['morning', 9 * 60, 12 * 60],
  ['afternoon', 12 * 60, 17 * 60],
  ['evening', 17 * 60, 22 * 60],
]

const TRANSITIONS: Record<string, OrderStatus[]> = {
  placed: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery', 'ready_for_pickup'],
  out_for_delivery: ['completed'],
  ready_for_pickup: ['completed'],
}

const CUSTOMER_COPY: Record<string, string> = {
  accepted: 'has been accepted and scheduled by the kitchen.',
  preparing: 'is now being prepared.',
  out_for_delivery: 'is out for delivery.',
  ready_for_pickup: 'is ready for pickup at the counter.',
  completed: 'has been completed. Thank you!',
  cancelled: 'was cancelled by the hotel.',
}

// ---------------------------------------------------------------- helpers ---

const minutes = (value: string) => {
  const [h, m] = value.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

const hhmm = (total: number) =>
  `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`

const localDate = (date = new Date()) => date.toLocaleDateString('en-CA')

const round2 = (value: number) => Math.round(value * 100) / 100

const slotDate = (isoDate: string, slot: string) => {
  const [y, m, d] = isoDate.split('-').map(Number)
  const [hh, mm] = (slot.split('-')[0] || '00:00').split(':').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0)
}

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}

const isOpenNow = (hotel: DemoHotel) => {
  if (!hotel.is_online) return false
  const now = new Date()
  const current = now.getHours() * 60 + now.getMinutes()
  const open = minutes(hotel.opening_time)
  const close = minutes(hotel.closing_time)
  return open <= close ? current >= open && current <= close : current >= open || current <= close
}

const mapUrl = (hotel: DemoHotel) => {
  if (hotel.google_map_url) return hotel.google_map_url
  if (hotel.latitude != null && hotel.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${hotel.latitude},${hotel.longitude}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotel.name} ${hotel.place}`)}`
}

const notify = (
  userId: number,
  title: string,
  body: string,
  type: 'order' | 'ticket' | 'system' = 'system',
  link = '',
) => {
  getDb().notifications.unshift({
    id: nextId(),
    userId,
    title,
    body,
    type,
    link,
    is_read: false,
    created_at: new Date().toISOString(),
  })
}

const requireUser = (token: string | null): DemoUser => {
  const db = getDb()
  const userId = token ? db.sessions[token] : undefined
  const user = userId ? db.users.find((entry) => entry.id === userId) : undefined
  if (!user) throw new ApiError(401, 'Your session has expired. Please sign in again.')
  if (!user.is_active) throw new ApiError(403, 'This account has been suspended.')
  return user
}

const requireRole = (token: string | null, roles: Role[]): DemoUser => {
  const user = requireUser(token)
  if (!roles.includes(user.role)) {
    throw new ApiError(403, 'Your role does not have access to this resource.')
  }
  return user
}

const workspaceHotel = (user: DemoUser): DemoHotel => {
  const db = getDb()
  const hotel = user.hotelId
    ? db.hotels.find((entry) => entry.id === user.hotelId)
    : db.hotels.find((entry) => entry.ownerId === user.id)
  if (!hotel) throw new ApiError(404, 'No hotel profile is linked to this account yet.')
  return hotel
}

const issueToken = (user: DemoUser) => {
  const db = getDb()
  const token = `demo.${user.id}.${Math.random().toString(36).slice(2)}`
  db.sessions[token] = user.id
  return token
}

// ------------------------------------------------------------ serialisers ---

const publicAddress = (address: DemoAddress) => ({
  id: address.id,
  label: address.label,
  address_line: address.address_line,
  latitude: address.latitude,
  longitude: address.longitude,
  is_default: address.is_default,
})

const publicNotification = (item: DemoNotification) => ({
  id: item.id,
  title: item.title,
  body: item.body,
  type: item.type,
  link: item.link,
  is_read: item.is_read,
  created_at: item.created_at,
})

const publicUser = (user: DemoUser) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  phone_number: user.phone_number,
})

const hotelCard = (hotel: DemoHotel) => ({
  id: hotel.id,
  name: hotel.name,
  place: hotel.place,
  contact_number: hotel.contact_number,
  google_map_url: mapUrl(hotel),
  banner_image: hotel.banner_image,
  cuisine: hotel.cuisine,
  rating: hotel.rating,
  rating_count: hotel.rating_count,
  has_delivery: hotel.has_delivery,
  is_open: isOpenNow(hotel),
  avg_delivery_minutes: hotel.avg_delivery_minutes,
})

const hotelDetail = (hotel: DemoHotel) => ({
  ...hotelCard(hotel),
  description: hotel.description,
  opening_time: `${hotel.opening_time}:00`,
  closing_time: `${hotel.closing_time}:00`,
  latitude: hotel.latitude,
  longitude: hotel.longitude,
  min_order_amount: hotel.min_order_amount,
  flat_delivery_fee: hotel.flat_delivery_fee,
  delivery_radius_km: hotel.delivery_radius_km,
  gallery_images: hotel.gallery_images,
  is_online: hotel.is_online,
  is_verified: hotel.is_verified,
})

const itemOut = (entry: DemoItem) => ({
  id: entry.id,
  name: entry.name,
  description: entry.description,
  price: entry.price,
  category: entry.category,
  image: entry.image,
  is_available: entry.is_available,
  is_veg: entry.is_veg,
  is_custom_order: entry.is_custom_order,
  preparation_time_hours: entry.preparation_time_hours,
})

const orderLines = (order: DemoOrder) =>
  order.lines.map((line) => ({ name: line.name, quantity: line.quantity, price: line.price }))

const etaOf = (order: DemoOrder) => {
  const hotel = getDb().hotels.find((entry) => entry.id === order.hotelId)
  const base = slotDate(order.scheduled_date, order.scheduled_slot)
  if (order.delivery_type === 'delivery' && hotel) {
    base.setMinutes(base.getMinutes() + hotel.avg_delivery_minutes)
  }
  return base.toISOString()
}

const statusPayload = (order: DemoOrder) => {
  const hotel = getDb().hotels.find((entry) => entry.id === order.hotelId)!
  return {
    order_id: order.id,
    status: order.status,
    eta: etaOf(order),
    delivery_type: order.delivery_type,
    hotel_name: hotel.name,
    hotel_phone: hotel.contact_number,
    hotel_address: hotel.place,
    hotel_map_url: mapUrl(hotel),
    hotel_coordinates:
      hotel.latitude != null && hotel.longitude != null
        ? { lat: hotel.latitude, lng: hotel.longitude }
        : null,
    user_coordinates:
      order.latitude != null && order.longitude != null
        ? { lat: order.latitude, lng: order.longitude }
        : null,
    user_address: order.address,
    total_amount: order.total_amount,
    payment_method: order.payment_method,
    can_cancel: order.status === 'placed',
    placed_at: order.created_at,
    accepted_at: order.accepted_at,
    completed_at: order.completed_at,
    items: orderLines(order),
    special_instructions: order.special_instructions,
  }
}

const historyPayload = (order: DemoOrder) => {
  const db = getDb()
  const hotel = db.hotels.find((entry) => entry.id === order.hotelId)!
  return {
    id: order.id,
    hotel_id: hotel.id,
    hotel_name: hotel.name,
    order_date: order.created_at,
    scheduled_time: `${order.scheduled_date} ${order.scheduled_slot}`,
    status: order.status,
    items_summary: order.lines.map((line) => `${line.name} (x${line.quantity})`).join(', '),
    items: orderLines(order),
    total_amount: order.total_amount,
    payment_method: order.payment_method,
    delivery_type: order.delivery_type,
    can_cancel: order.status === 'placed',
    has_review: db.reviews.some((review) => review.orderId === order.id),
  }
}

const queuePayload = (order: DemoOrder) => {
  const buyer = getDb().users.find((entry) => entry.id === order.buyerId)
  return {
    id: order.id,
    customer_name: buyer?.name ?? 'Guest',
    customer_phone: buyer?.phone_number ?? '',
    items: orderLines(order),
    delivery_type: order.delivery_type,
    address: order.address,
    scheduled_time: `${order.scheduled_date} ${order.scheduled_slot}`,
    placed_at: order.created_at,
    total_price: order.total_amount,
    status: order.status,
    special_instructions: order.special_instructions,
    map_url:
      order.latitude != null && order.longitude != null
        ? `https://www.google.com/maps/search/?api=1&query=${order.latitude},${order.longitude}`
        : '',
  }
}

const ticketPayload = (ticket: ReturnType<typeof getDb>['tickets'][number]) => ({
  id: ticket.id,
  subject: ticket.subject,
  message: ticket.message,
  order_id: ticket.orderId,
  status: ticket.status,
  created_at: ticket.created_at,
  updated_at: ticket.updated_at,
  responses: ticket.responses,
})

// -------------------------------------------------------------- analytics ---

const reportWindow = (start?: string, end?: string) => {
  const today = new Date()
  const fallbackStart = new Date(today)
  fallbackStart.setDate(today.getDate() - 6)
  return {
    start: start || localDate(fallbackStart),
    end: end || localDate(today),
  }
}

const buildReport = (hotel: DemoHotel, start: string, end: string) => {
  const db = getDb()
  const orders = db.orders.filter((order) => {
    if (order.hotelId !== hotel.id || order.status !== 'completed' || !order.completed_at) return false
    const day = localDate(new Date(order.completed_at))
    return day >= start && day <= end
  })

  const totalSales = round2(orders.reduce((sum, order) => sum + order.total_amount, 0))
  const buckets = new Map<string, { name: string; qty_sold: number; revenue: number; rating: number }>()
  const daily = new Map<string, number>()

  const cursor = new Date(`${start}T00:00:00`)
  const stop = new Date(`${end}T00:00:00`)
  while (cursor <= stop) {
    daily.set(localDate(cursor), 0)
    cursor.setDate(cursor.getDate() + 1)
  }

  const ratings = new Map<string, number[]>()
  db.reviews
    .filter((review) => review.hotelId === hotel.id)
    .forEach((review) => {
      const order = db.orders.find((entry) => entry.id === review.orderId)
      order?.lines.forEach((line) => {
        ratings.set(line.name, [...(ratings.get(line.name) ?? []), review.rating])
      })
    })

  orders.forEach((order) => {
    const day = localDate(new Date(order.completed_at!))
    if (daily.has(day)) daily.set(day, round2((daily.get(day) ?? 0) + order.total_amount))
    order.lines.forEach((line) => {
      const bucket = buckets.get(line.name) ?? { name: line.name, qty_sold: 0, revenue: 0, rating: 0 }
      bucket.qty_sold += line.quantity
      bucket.revenue = round2(bucket.revenue + line.price * line.quantity)
      buckets.set(line.name, bucket)
    })
  })

  const topItems = [...buckets.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((row) => {
      const stars = ratings.get(row.name) ?? []
      const avg = stars.length ? Math.round((stars.reduce((s, v) => s + v, 0) / stars.length) * 10) / 10 : 0
      return { ...row, rating: avg }
    })

  return {
    total_sales: totalSales,
    avg_order_value: orders.length ? round2(totalSales / orders.length) : 0,
    total_orders: orders.length,
    top_items: topItems,
    daily_series: [...daily.entries()].map(([date, sales]) => ({ date, sales })),
  }
}

// ----------------------------------------------------------------- routes ---

type Ctx = { params: string[]; query: URLSearchParams; body: Record<string, unknown>; token: string | null }
type Handler = (ctx: Ctx) => unknown

const routes: [string, RegExp, Handler][] = []
const on = (method: string, pattern: string, handler: Handler) => {
  const regex = new RegExp(`^${pattern.replace(/:\w+/g, '([^/]+)')}$`)
  routes.push([method, regex, handler])
}

const str = (body: Record<string, unknown>, key: string, fallback = '') =>
  typeof body[key] === 'string' ? (body[key] as string) : fallback
const num = (body: Record<string, unknown>, key: string, fallback = 0) =>
  typeof body[key] === 'number' ? (body[key] as number) : fallback
const bool = (body: Record<string, unknown>, key: string, fallback = false) =>
  typeof body[key] === 'boolean' ? (body[key] as boolean) : fallback

// --- auth -------------------------------------------------------------------

on('POST', '/auth/register/', ({ body }) => {
  const db = getDb()
  const email = str(body, 'email').toLowerCase().trim()
  const password = str(body, 'password')
  const role = (str(body, 'role', 'customer') as Role) || 'customer'

  if (!db.config.allow_registrations) throw new ApiError(403, 'New registrations are paused by the administrator.')
  if (db.users.some((user) => user.email === email)) {
    throw new ApiError(409, 'An account with this email already exists.')
  }
  if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new ApiError(422, 'Password must be at least 8 characters and include an uppercase letter and a digit.')
  }

  const user: DemoUser = {
    id: nextId(),
    email,
    password,
    name: str(body, 'name').trim() || 'New user',
    phone_number: str(body, 'phone'),
    role: role === 'distributor' ? 'distributor' : 'customer',
    hotelId: null,
    is_active: true,
  }
  db.users.push(user)

  if (user.role === 'distributor') {
    db.hotels.push({
      id: nextId(),
      ownerId: user.id,
      name: str(body, 'hotel_name') || `${user.name}'s Kitchen`,
      place: str(body, 'hotel_address'),
      contact_number: user.phone_number,
      description: '',
      cuisine: '',
      banner_image: '',
      gallery_images: [],
      google_map_url: '',
      latitude: null,
      longitude: null,
      opening_time: '09:00',
      closing_time: '22:00',
      is_online: false,
      is_verified: false,
      rejection_reason: '',
      has_delivery: true,
      min_order_amount: 0,
      flat_delivery_fee: 0,
      delivery_radius_km: 10,
      avg_delivery_minutes: 35,
      slots: { morning: true, afternoon: true, evening: true },
      rating: 0,
      rating_count: 0,
      created_at: new Date().toISOString(),
    })
    notify(user.id, 'Listing submitted for review', 'An administrator will verify your hotel shortly.', 'system', '/distributor')
  } else {
    notify(user.id, 'Welcome to Hotel Express', 'Browse hotels near you and schedule your first order.', 'system', '/')
  }

  const token = issueToken(user)
  save()
  return { access: token, refresh: token, user: publicUser(user) }
})

on('POST', '/auth/login/', ({ body }) => {
  const db = getDb()
  const email = str(body, 'email').toLowerCase().trim()
  const user = db.users.find((entry) => entry.email === email)
  if (!user || user.password !== str(body, 'password')) {
    throw new ApiError(401, 'Incorrect email or password.')
  }
  if (!user.is_active) throw new ApiError(403, 'This account has been suspended. Contact your administrator.')
  const token = issueToken(user)
  save()
  return { access: token, refresh: token, user: publicUser(user) }
})

on('POST', '/auth/refresh/', ({ body }) => {
  const user = requireUser(str(body, 'refresh') || null)
  const token = issueToken(user)
  save()
  return { access: token, refresh: token, user: publicUser(user) }
})

on('GET', '/auth/me/', ({ token }) => publicUser(requireUser(token)))

on('PUT', '/auth/profile/update/', ({ token, body }) => {
  const user = requireUser(token)
  user.name = str(body, 'name').trim() || user.name
  user.phone_number = str(body, 'phone_number')
  save()
  return publicUser(user)
})

on('POST', '/auth/profile/password/', ({ token, body }) => {
  const user = requireUser(token)
  const current = str(body, 'old_password')
  const next = str(body, 'new_password')
  if (user.password !== current) throw new ApiError(400, 'Your current password is incorrect.')
  if (current === next) throw new ApiError(400, 'The new password must be different from the current one.')
  if (next.length < 8) throw new ApiError(400, 'The new password must be at least 8 characters long.')
  user.password = next
  save()
  return { success: true, message: 'Password updated successfully.' }
})

on('GET', '/auth/addresses/', ({ token }) => {
  const user = requireUser(token)
  return getDb()
    .addresses.filter((entry) => entry.userId === user.id)
    .map(publicAddress)
})

on('POST', '/auth/addresses/', ({ token, body }) => {
  const user = requireUser(token)
  const db = getDb()
  const isFirst = !db.addresses.some((entry) => entry.userId === user.id)
  const address = {
    id: nextId(),
    userId: user.id,
    label: str(body, 'label', 'Home'),
    address_line: str(body, 'address_line'),
    latitude: (body.latitude as number | null) ?? null,
    longitude: (body.longitude as number | null) ?? null,
    is_default: bool(body, 'is_default') || isFirst,
  }
  if (address.is_default) {
    db.addresses.filter((entry) => entry.userId === user.id).forEach((entry) => (entry.is_default = false))
  }
  db.addresses.push(address)
  save()
  return publicAddress(address)
})

on('PUT', '/auth/addresses/:id/', ({ token, params, body }) => {
  const user = requireUser(token)
  const db = getDb()
  const address = db.addresses.find((entry) => entry.id === Number(params[0]) && entry.userId === user.id)
  if (!address) throw new ApiError(404, 'Address not found.')
  address.label = str(body, 'label', address.label)
  address.address_line = str(body, 'address_line', address.address_line)
  address.latitude = (body.latitude as number | null) ?? address.latitude
  address.longitude = (body.longitude as number | null) ?? address.longitude
  address.is_default = bool(body, 'is_default', address.is_default)
  if (address.is_default) {
    db.addresses
      .filter((entry) => entry.userId === user.id && entry.id !== address.id)
      .forEach((entry) => (entry.is_default = false))
  }
  save()
  return publicAddress(address)
})

on('DELETE', '/auth/addresses/:id/', ({ token, params }) => {
  const user = requireUser(token)
  const db = getDb()
  db.addresses = db.addresses.filter(
    (entry) => !(entry.id === Number(params[0]) && entry.userId === user.id),
  )
  save()
  return { success: true, message: 'Address removed.' }
})

// --- public hotels ----------------------------------------------------------

on('GET', '/hotels/', ({ query }) => {
  const db = getDb()
  const search = (query.get('search') ?? '').toLowerCase().trim()
  const filter = query.get('filter_type') ?? 'all'

  let hotels = db.hotels.filter((hotel) => hotel.is_verified)
  if (search) {
    hotels = hotels.filter((hotel) => {
      const haystack = `${hotel.name} ${hotel.place} ${hotel.cuisine}`.toLowerCase()
      if (haystack.includes(search)) return true
      return db.items.some(
        (entry) => entry.hotelId === hotel.id && entry.name.toLowerCase().includes(search),
      )
    })
  }
  if (filter === 'delivery' || filter === 'delivery_available') {
    hotels = hotels.filter((hotel) => hotel.has_delivery)
  } else if (filter === 'fast_delivery') {
    hotels = hotels.filter((hotel) => hotel.has_delivery && hotel.avg_delivery_minutes < 30)
  } else if (filter === 'top_rated') {
    hotels = hotels.filter((hotel) => hotel.rating >= 4).sort((a, b) => b.rating - a.rating)
  }

  const cards = hotels.map(hotelCard)
  return filter === 'open_now' ? cards.filter((card) => card.is_open) : cards
})

on('GET', '/hotels/:id/', ({ params }) => {
  const hotel = getDb().hotels.find((entry) => entry.id === Number(params[0]) && entry.is_verified)
  if (!hotel) throw new ApiError(404, 'Hotel not found.')
  return hotelDetail(hotel)
})

on('GET', '/hotels/:id/menu/', ({ params }) => {
  const db = getDb()
  const hotelId = Number(params[0])
  const items = db.items.filter((entry) => entry.hotelId === hotelId && entry.is_available)
  return {
    categories: [...new Set(items.map((entry) => entry.category))],
    items: items.map(itemOut),
  }
})

on('GET', '/hotels/:id/delivery-slots/', ({ params, query }) => {
  const db = getDb()
  const hotel = db.hotels.find((entry) => entry.id === Number(params[0]))
  if (!hotel) throw new ApiError(404, 'Hotel not found.')
  const target = query.get('date') || localDate()

  const booked = new Map<string, number>()
  db.orders
    .filter((order) => order.hotelId === hotel.id && order.scheduled_date === target && order.status !== 'cancelled')
    .forEach((order) => booked.set(order.scheduled_slot, (booked.get(order.scheduled_slot) ?? 0) + 1))

  const open = minutes(hotel.opening_time)
  let close = minutes(hotel.closing_time)
  if (close <= open) close += 24 * 60
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const isToday = target === localDate()

  const slots = []
  for (let cursor = open; cursor + 30 <= close; cursor += 30) {
    const label = `${hhmm(cursor)}-${hhmm(cursor + 30)}`
    const block = SLOT_BLOCKS.find(([, from, to]) => cursor >= from && cursor < to)
    slots.push({
      slot: label,
      start: hhmm(cursor),
      is_full: (booked.get(label) ?? 0) >= 8,
      is_past: isToday && cursor <= nowMinutes,
      is_enabled: block ? hotel.slots[block[0]] : true,
    })
  }

  return {
    date: target,
    operating_hours: { open: `${hotel.opening_time}:00`, close: `${hotel.closing_time}:00` },
    booked_slots_capacity: slots,
  }
})

// --- customer orders --------------------------------------------------------

on('POST', '/orders/create/', ({ token, body }) => {
  const user = requireUser(token)
  const db = getDb()
  const hotel = db.hotels.find((entry) => entry.id === num(body, 'hotel_id') && entry.is_verified)
  if (!hotel) throw new ApiError(404, 'Hotel not found.')
  if (db.config.maintenance_mode) throw new ApiError(503, db.config.maintenance_message)
  if (!hotel.is_online) throw new ApiError(409, 'This hotel is currently closed and not accepting orders.')

  const requested = (body.items as { food_item_id: number; quantity: number }[]) ?? []
  if (!requested.length) throw new ApiError(400, 'Your cart is empty.')

  const deliveryType = (str(body, 'delivery_type', 'pickup') as DeliveryType) || 'pickup'
  if (deliveryType === 'delivery' && !hotel.has_delivery) {
    throw new ApiError(409, 'This hotel does not offer home delivery. Please choose self-pickup.')
  }

  const lines = requested.map((entry) => {
    const item = db.items.find(
      (candidate) => candidate.id === entry.food_item_id && candidate.hotelId === hotel.id && candidate.is_available,
    )
    if (!item) throw new ApiError(409, 'Some items are no longer available. Please refresh the menu.')
    return { food_item_id: item.id, name: item.name, quantity: entry.quantity, price: item.price, prep: item.preparation_time_hours }
  })

  const scheduledDate = str(body, 'delivery_date')
  const slot = str(body, 'delivery_time_slot')
  const today = localDate()
  const horizon = new Date()
  horizon.setDate(horizon.getDate() + 14)
  if (!scheduledDate || scheduledDate < today) throw new ApiError(400, 'You cannot schedule an order in the past.')
  if (scheduledDate > localDate(horizon)) throw new ApiError(400, 'Orders can only be scheduled up to 14 days ahead.')

  const totals = priceLines(lines, hotel.flat_delivery_fee, deliveryType)
  const latitude = (body.latitude as number | null) ?? null
  const longitude = (body.longitude as number | null) ?? null

  if (deliveryType === 'delivery') {
    if (!str(body, 'address').trim()) throw new ApiError(400, 'A delivery address is required for home delivery.')
    if (totals.subtotal < hotel.min_order_amount) {
      throw new ApiError(409, `Minimum order amount for home delivery from this hotel is ${hotel.min_order_amount.toFixed(2)}.`)
    }
    if (latitude != null && longitude != null && hotel.latitude != null && hotel.longitude != null) {
      const distance = haversineKm(hotel.latitude, hotel.longitude, latitude, longitude)
      if (distance > hotel.delivery_radius_km) {
        throw new ApiError(409, `Your location is ${distance.toFixed(1)} km away, outside this hotel's ${hotel.delivery_radius_km} km delivery boundary.`)
      }
    }
  }

  const maxPrep = Math.max(0, ...lines.map((line) => line.prep))
  if (slotDate(scheduledDate, slot).getTime() < Date.now() + maxPrep * 3600_000) {
    throw new ApiError(409, 'That slot no longer satisfies the preparation lead time for your items. Please pick a later slot.')
  }

  const order: DemoOrder = {
    id: nextId(),
    buyerId: user.id,
    hotelId: hotel.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    scheduled_date: scheduledDate,
    scheduled_slot: slot,
    status: 'placed',
    delivery_type: deliveryType,
    address: str(body, 'address'),
    latitude,
    longitude,
    ...totals,
    payment_method: 'offline',
    special_instructions: str(body, 'special_instructions'),
    rejection_reason: '',
    accepted_at: null,
    completed_at: null,
    lines: lines.map((line) => ({
      food_item_id: line.food_item_id,
      name: line.name,
      quantity: line.quantity,
      price: line.price,
    })),
  }
  db.orders.unshift(order)

  notify(hotel.ownerId, 'New order received', `Order #${order.id} has been placed for ${order.scheduled_slot}.`, 'order', '/distributor/orders')
  notify(user.id, 'Order placed', `Order #${order.id} at ${hotel.name} is awaiting confirmation.`, 'order', `/orders/track/${order.id}`)

  // Kitchen ticket to the distributor plus a confirmation to the buyer. Fire and
  // forget: mail must never be able to fail an order that is already placed.
  const owner = db.users.find((entry) => entry.id === hotel.ownerId)
  if (owner) {
    void sendOrderEmails(order, hotel, owner, user)
      .then((messages) => {
        messages.forEach((message) => db.outbox.unshift({ id: nextId(), ...message }))
        notify(
          hotel.ownerId,
          'Order email sent',
          `The ticket for order #${order.id} was sent to ${owner.email}.`,
          'system',
          '/outbox',
        )
        save()
      })
      .catch(() => undefined)
  }

  save()

  return {
    success: true,
    order_id: order.id,
    status: order.status,
    delivery_type: order.delivery_type,
    scheduled_time: `${order.scheduled_date} ${order.scheduled_slot}`,
    total_amount: order.total_amount,
  }
})

on('GET', '/orders/active/', ({ token }) => {
  const user = requireUser(token)
  return getDb()
    .orders.filter((order) => order.buyerId === user.id && ACTIVE.includes(order.status))
    .map(statusPayload)
})

on('GET', '/orders/history/', ({ token, query }) => {
  const user = requireUser(token)
  const status = query.get('status') ?? 'all'
  let orders = getDb().orders.filter((order) => order.buyerId === user.id)
  if (status === 'active') orders = orders.filter((order) => ACTIVE.includes(order.status))
  else if (status === 'completed' || status === 'cancelled') {
    orders = orders.filter((order) => order.status === status)
  }
  orders = [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at))

  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE))
  const page = Math.min(Math.max(Number(query.get('page') ?? 1), 1), totalPages)
  return {
    results: orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(historyPayload),
    current_page: page,
    total_pages: totalPages,
    total_count: orders.length,
  }
})

on('GET', '/orders/:id/status/', ({ token, params }) => {
  const user = requireUser(token)
  const order = getDb().orders.find((entry) => entry.id === Number(params[0]) && entry.buyerId === user.id)
  if (!order) throw new ApiError(404, 'Order not found.')
  return statusPayload(order)
})

on('POST', '/orders/:id/cancel/', ({ token, params }) => {
  const user = requireUser(token)
  const db = getDb()
  const order = db.orders.find((entry) => entry.id === Number(params[0]) && entry.buyerId === user.id)
  if (!order) throw new ApiError(404, 'Order not found.')
  if (order.status !== 'placed') {
    throw new ApiError(409, 'This order is being prepared and can no longer be cancelled. Contact the hotel for adjustments.')
  }
  order.status = 'cancelled'
  order.updated_at = new Date().toISOString()
  const hotel = db.hotels.find((entry) => entry.id === order.hotelId)
  if (hotel) notify(hotel.ownerId, 'Order cancelled', `Order #${order.id} was cancelled by the customer.`, 'order', '/distributor/orders')
  save()
  return { success: true, message: 'Order cancelled.' }
})

on('POST', '/orders/:id/review/', ({ token, params, body }) => {
  const user = requireUser(token)
  const db = getDb()
  const order = db.orders.find((entry) => entry.id === Number(params[0]) && entry.buyerId === user.id)
  if (!order) throw new ApiError(404, 'Order not found.')
  if (order.status !== 'completed') throw new ApiError(409, 'You can only review completed orders.')
  if (db.reviews.some((review) => review.orderId === order.id)) {
    throw new ApiError(409, 'You have already reviewed this order.')
  }
  const rating = num(body, 'rating', 5)
  if (rating < 1 || rating > 5) throw new ApiError(400, 'Rating must be between 1 and 5 stars.')

  db.reviews.push({
    id: nextId(),
    orderId: order.id,
    hotelId: order.hotelId,
    authorId: user.id,
    rating,
    comment: str(body, 'comment'),
    created_at: new Date().toISOString(),
  })
  const hotel = db.hotels.find((entry) => entry.id === order.hotelId)
  if (hotel) {
    const total = hotel.rating * hotel.rating_count + rating
    hotel.rating_count += 1
    hotel.rating = Math.round((total / hotel.rating_count) * 100) / 100
  }
  save()
  return { success: true, message: 'Review recorded.' }
})

on('GET', '/orders/:id/invoice/', ({ token, params }) => {
  const user = requireUser(token)
  const db = getDb()
  const order = db.orders.find((entry) => entry.id === Number(params[0]) && entry.buyerId === user.id)
  if (!order) throw new ApiError(404, 'Order not found.')
  const hotel = db.hotels.find((entry) => entry.id === order.hotelId)!

  const pdf = new PdfDoc()
  pdf.line('Hotel Express - Tax Invoice', { size: 18, bold: true, advance: 26 })
  pdf.line(`Invoice for Order #${order.id}`, { size: 10 })
  pdf.line(`Issued: ${new Date(order.created_at).toLocaleString()}`, { size: 10, advance: 26 })
  pdf.line(hotel.name, { size: 12, bold: true })
  pdf.line(hotel.place || '-', { size: 10 })
  pdf.line(`Tel: ${hotel.contact_number || '-'}`, { size: 10, advance: 24 })
  pdf.line(`Billed to: ${user.name} (${user.email})`, { size: 10 })
  pdf.line(
    `Fulfilment: ${order.delivery_type === 'delivery' ? 'Home delivery' : 'Self pickup'} - ${order.scheduled_date} ${order.scheduled_slot}`,
    { size: 10 },
  )
  if (order.address) pdf.line(`Address: ${order.address.slice(0, 90)}`, { size: 10 })
  pdf.gap(14)

  pdf.text('Item', PAGE.left, pdf.cursor, { bold: true })
  pdf.text('Qty', 380, pdf.cursor, { bold: true, align: 'right' })
  pdf.text('Unit', 450, pdf.cursor, { bold: true, align: 'right' })
  pdf.text('Amount', PAGE.right, pdf.cursor, { bold: true, align: 'right' })
  pdf.cursor -= 6
  pdf.rule()
  pdf.cursor -= 12

  order.lines.forEach((entry) => {
    pdf.text(entry.name.slice(0, 46), PAGE.left, pdf.cursor)
    pdf.text(String(entry.quantity), 380, pdf.cursor, { align: 'right' })
    pdf.text(entry.price.toFixed(2), 450, pdf.cursor, { align: 'right' })
    pdf.text((entry.price * entry.quantity).toFixed(2), PAGE.right, pdf.cursor, { align: 'right' })
    pdf.cursor -= 16
  })

  pdf.rule(pdf.cursor + 6, 330)
  pdf.cursor -= 8
  ;[
    ['Subtotal', order.subtotal],
    ['Delivery fee', order.delivery_fee],
    ['Tax', order.tax_amount],
  ].forEach(([label, value]) => {
    pdf.text(String(label), 450, pdf.cursor, { align: 'right' })
    pdf.text(Number(value).toFixed(2), PAGE.right, pdf.cursor, { align: 'right' })
    pdf.cursor -= 16
  })
  pdf.cursor -= 4
  pdf.text('Total', 450, pdf.cursor, { align: 'right', bold: true, size: 12 })
  pdf.text(order.total_amount.toFixed(2), PAGE.right, pdf.cursor, { align: 'right', bold: true, size: 12 })
  pdf.cursor -= 32
  pdf.line('Payment method: Offline (cash on delivery / pay at the hotel counter).', { size: 9 })
  pdf.line(`Order status at time of download: ${order.status.replace(/_/g, ' ')}.`, { size: 9 })

  return pdf.toBlob()
})

// --- notifications ----------------------------------------------------------

on('GET', '/notifications/', ({ token }) => {
  const user = requireUser(token)
  return getDb()
    .notifications.filter((entry) => entry.userId === user.id)
    .slice(0, 60)
    .map(publicNotification)
})

on('POST', '/notifications/mark-read/', ({ token, body }) => {
  const user = requireUser(token)
  const ids = (body.notification_ids as number[]) ?? []
  getDb()
    .notifications.filter((entry) => entry.userId === user.id && (!ids.length || ids.includes(entry.id)))
    .forEach((entry) => (entry.is_read = true))
  save()
  return { success: true, message: 'Notifications marked as read.' }
})

// --- support ----------------------------------------------------------------

on('GET', '/support/faqs/', ({ query }) => {
  const search = (query.get('search') ?? '').toLowerCase()
  return getDb().faqs.filter((entry) => !search || entry.question.toLowerCase().includes(search))
})

on('GET', '/support/tickets/', ({ token }) => {
  const user = requireUser(token)
  return getDb()
    .tickets.filter((entry) => entry.userId === user.id)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map(ticketPayload)
})

on('POST', '/support/tickets/create/', ({ token, body }) => {
  const user = requireUser(token)
  const db = getDb()
  const subject = str(body, 'subject').trim()
  const message = str(body, 'message').trim()
  if (!subject || !message) throw new ApiError(400, 'Both a subject and a message are required.')
  const ticket = {
    id: nextId(),
    userId: user.id,
    subject,
    message,
    orderId: (body.order_id as number | null) ?? null,
    status: 'open' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    responses: [],
  }
  db.tickets.unshift(ticket)
  notify(user.id, 'Support ticket created', `Ticket #${ticket.id} — we'll get back to you shortly.`, 'ticket', '/help')
  save()
  return ticketPayload(ticket)
})

on('POST', '/support/tickets/:id/reply/', ({ token, params, body }) => {
  const user = requireUser(token)
  const ticket = getDb().tickets.find((entry) => entry.id === Number(params[0]) && entry.userId === user.id)
  if (!ticket) throw new ApiError(404, 'Ticket not found.')
  const message = str(body, 'message').trim()
  if (!message) throw new ApiError(400, 'Message cannot be empty.')
  ticket.responses.push({ sender: user.name, message, timestamp: new Date().toISOString() })
  ticket.status = 'open'
  ticket.updated_at = new Date().toISOString()
  save()
  return ticketPayload(ticket)
})

on('POST', '/support/tickets/:id/close/', ({ token, params }) => {
  const user = requireUser(token)
  const ticket = getDb().tickets.find((entry) => entry.id === Number(params[0]) && entry.userId === user.id)
  if (!ticket) throw new ApiError(404, 'Ticket not found.')
  ticket.status = 'resolved'
  ticket.updated_at = new Date().toISOString()
  save()
  return { success: true, message: 'Ticket closed.' }
})

// --- distributor: profile & logistics ---------------------------------------

on('GET', '/distributor/hotel/', ({ token }) => hotelDetail(workspaceHotel(requireRole(token, DISTRIBUTOR_SIDE))))

on('PUT', '/distributor/hotel/update/', ({ token, body }) => {
  const hotel = workspaceHotel(requireRole(token, ['distributor', 'manager']))
  const opening = str(body, 'opening_time', hotel.opening_time).slice(0, 5)
  const closing = str(body, 'closing_time', hotel.closing_time).slice(0, 5)
  if (opening === closing) throw new ApiError(400, 'Closing time must be after opening time.')

  hotel.name = str(body, 'name', hotel.name)
  hotel.place = str(body, 'place')
  hotel.contact_number = str(body, 'contact_number')
  hotel.description = str(body, 'description')
  hotel.cuisine = str(body, 'cuisine')
  hotel.opening_time = opening
  hotel.closing_time = closing
  hotel.latitude = (body.latitude as number | null) ?? hotel.latitude
  hotel.longitude = (body.longitude as number | null) ?? hotel.longitude
  hotel.google_map_url = str(body, 'google_map_url')
  hotel.banner_image = str(body, 'banner_image', hotel.banner_image)
  hotel.gallery_images = (body.gallery_images as string[]) ?? hotel.gallery_images
  save()
  return hotelDetail(hotel)
})

on('POST', '/distributor/status/toggle/', ({ token }) => {
  const hotel = workspaceHotel(requireRole(token, DISTRIBUTOR_SIDE))
  hotel.is_online = !hotel.is_online
  save()
  return { success: true, is_online: hotel.is_online }
})

const deliveryConfig = (hotel: DemoHotel) => ({
  has_delivery: hotel.has_delivery,
  min_order_amount: hotel.min_order_amount,
  flat_delivery_fee: hotel.flat_delivery_fee,
  delivery_radius_km: hotel.delivery_radius_km,
  avg_delivery_minutes: hotel.avg_delivery_minutes,
  active_slots: hotel.slots,
})

on('GET', '/distributor/delivery-settings/', ({ token }) =>
  deliveryConfig(workspaceHotel(requireRole(token, DISTRIBUTOR_SIDE))),
)

on('PUT', '/distributor/delivery-settings/update/', ({ token, body }) => {
  const hotel = workspaceHotel(requireRole(token, ['distributor', 'manager']))
  hotel.has_delivery = bool(body, 'has_delivery', hotel.has_delivery)
  hotel.min_order_amount = num(body, 'min_order_amount', hotel.min_order_amount)
  hotel.flat_delivery_fee = num(body, 'flat_delivery_fee', hotel.flat_delivery_fee)
  hotel.delivery_radius_km = num(body, 'delivery_radius_km', hotel.delivery_radius_km)
  hotel.avg_delivery_minutes = num(body, 'avg_delivery_minutes', hotel.avg_delivery_minutes)
  const slots = (body.active_slots as DemoHotel['slots']) ?? hotel.slots
  hotel.slots = {
    morning: Boolean(slots.morning),
    afternoon: Boolean(slots.afternoon),
    evening: Boolean(slots.evening),
  }
  save()
  return deliveryConfig(hotel)
})

// --- distributor: menu ------------------------------------------------------

on('GET', '/distributor/menu/', ({ token }) => {
  const hotel = workspaceHotel(requireRole(token, DISTRIBUTOR_SIDE))
  const db = getDb()
  const categories = db.categories
    .filter((entry) => entry.hotelId === hotel.id)
    .sort((a, b) => a.position - b.position)
    .map((entry) => entry.name)
  return {
    categories: categories.length ? categories : ['Starters', 'Main Course', 'Breads', 'Desserts', 'Drinks'],
    items: db.items.filter((entry) => entry.hotelId === hotel.id).map(itemOut),
  }
})

on('POST', '/distributor/menu/categories/', ({ token, body }) => {
  const hotel = workspaceHotel(requireRole(token, ['distributor', 'manager']))
  const db = getDb()
  const name = str(body, 'name').trim()
  if (!name) throw new ApiError(400, 'Category name cannot be empty.')
  if (db.categories.some((entry) => entry.hotelId === hotel.id && entry.name.toLowerCase() === name.toLowerCase())) {
    throw new ApiError(409, 'That category already exists.')
  }
  db.categories.push({
    id: nextId(),
    hotelId: hotel.id,
    name,
    position: db.categories.filter((entry) => entry.hotelId === hotel.id).length,
  })
  save()
  return { success: true, message: `Category '${name}' created.` }
})

on('DELETE', '/distributor/menu/categories/:name/', ({ token, params }) => {
  const hotel = workspaceHotel(requireRole(token, ['distributor', 'manager']))
  const db = getDb()
  const name = decodeURIComponent(params[0])
  if (db.items.some((entry) => entry.hotelId === hotel.id && entry.category.toLowerCase() === name.toLowerCase())) {
    throw new ApiError(409, 'Move or delete the items in this category first.')
  }
  db.categories = db.categories.filter(
    (entry) => !(entry.hotelId === hotel.id && entry.name.toLowerCase() === name.toLowerCase()),
  )
  save()
  return { success: true, message: 'Category removed.' }
})

const applyItem = (item: DemoItem, body: Record<string, unknown>) => {
  item.name = str(body, 'name', item.name)
  item.description = str(body, 'description')
  item.price = num(body, 'price', item.price)
  item.category = str(body, 'category', item.category)
  item.image = str(body, 'image')
  item.is_available = bool(body, 'is_available', item.is_available)
  item.is_veg = bool(body, 'is_veg', item.is_veg)
  item.is_custom_order = bool(body, 'is_custom_order', item.is_custom_order)
  item.preparation_time_hours = item.is_custom_order ? num(body, 'preparation_time_hours', 1) : 0
}

on('POST', '/distributor/menu/items/', ({ token, body }) => {
  const hotel = workspaceHotel(requireRole(token, ['distributor', 'manager']))
  const db = getDb()
  if (num(body, 'price') <= 0) throw new ApiError(400, 'Price must be greater than zero.')
  const item: DemoItem = {
    id: nextId(),
    hotelId: hotel.id,
    name: '',
    description: '',
    price: 0,
    category: 'Mains',
    image: '',
    is_available: true,
    is_veg: true,
    is_custom_order: false,
    preparation_time_hours: 0,
  }
  applyItem(item, body)
  db.items.push(item)
  if (!db.categories.some((entry) => entry.hotelId === hotel.id && entry.name === item.category)) {
    db.categories.push({
      id: nextId(),
      hotelId: hotel.id,
      name: item.category,
      position: db.categories.filter((entry) => entry.hotelId === hotel.id).length,
    })
  }
  save()
  return itemOut(item)
})

on('PUT', '/distributor/menu/items/:id/', ({ token, params, body }) => {
  const hotel = workspaceHotel(requireRole(token, ['distributor', 'manager']))
  const item = getDb().items.find((entry) => entry.id === Number(params[0]) && entry.hotelId === hotel.id)
  if (!item) throw new ApiError(404, 'Menu item not found.')
  if (num(body, 'price') <= 0) throw new ApiError(400, 'Price must be greater than zero.')
  applyItem(item, body)
  save()
  return itemOut(item)
})

on('PUT', '/distributor/menu/items/:id/toggle-stock/', ({ token, params }) => {
  const hotel = workspaceHotel(requireRole(token, DISTRIBUTOR_SIDE))
  const item = getDb().items.find((entry) => entry.id === Number(params[0]) && entry.hotelId === hotel.id)
  if (!item) throw new ApiError(404, 'Menu item not found.')
  item.is_available = !item.is_available
  save()
  return itemOut(item)
})

on('DELETE', '/distributor/menu/items/:id/', ({ token, params }) => {
  const hotel = workspaceHotel(requireRole(token, ['distributor', 'manager']))
  const db = getDb()
  db.items = db.items.filter((entry) => !(entry.id === Number(params[0]) && entry.hotelId === hotel.id))
  save()
  return { success: true, message: 'Menu item deleted.' }
})

// --- distributor: queue & analytics -----------------------------------------

on('GET', '/distributor/orders/', ({ token }) => {
  const hotel = workspaceHotel(requireRole(token, DISTRIBUTOR_SIDE))
  const orders = getDb()
    .orders.filter((order) => order.hotelId === hotel.id)
    .sort((a, b) => `${a.scheduled_date}${a.scheduled_slot}`.localeCompare(`${b.scheduled_date}${b.scheduled_slot}`))

  return {
    incoming: orders.filter((order) => order.status === 'placed').map(queuePayload),
    preparing: orders.filter((order) => order.status === 'accepted' || order.status === 'preparing').map(queuePayload),
    ready: orders
      .filter((order) => order.status === 'out_for_delivery' || order.status === 'ready_for_pickup')
      .map(queuePayload),
    completed: orders
      .filter((order) => order.status === 'completed' || order.status === 'cancelled')
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 20)
      .map(queuePayload),
  }
})

on('POST', '/distributor/orders/:id/update-status/', ({ token, params, body }) => {
  const user = requireRole(token, DISTRIBUTOR_SIDE)
  const hotel = workspaceHotel(user)
  const db = getDb()
  const order = db.orders.find((entry) => entry.id === Number(params[0]) && entry.hotelId === hotel.id)
  if (!order) throw new ApiError(404, 'Order not found.')

  let target = str(body, 'status') as OrderStatus
  if (user.role === 'courier' && !['out_for_delivery', 'completed'].includes(target)) {
    throw new ApiError(403, 'Delivery agents may only dispatch and complete orders.')
  }
  if (!(TRANSITIONS[order.status] ?? []).includes(target)) {
    throw new ApiError(409, `An order that is '${order.status.replace(/_/g, ' ')}' cannot move to '${target}'.`)
  }
  if (target === 'out_for_delivery' && order.delivery_type !== 'delivery') target = 'ready_for_pickup'
  if (target === 'ready_for_pickup' && order.delivery_type === 'delivery') target = 'out_for_delivery'

  order.status = target
  order.updated_at = new Date().toISOString()
  if (target === 'accepted') order.accepted_at = new Date().toISOString()
  if (target === 'completed') order.completed_at = new Date().toISOString()
  if (target === 'cancelled') order.rejection_reason = str(body, 'rejection_reason')

  let message = `Order #${order.id} ${CUSTOMER_COPY[target] ?? 'was updated.'}`
  if (target === 'cancelled' && order.rejection_reason) message += ` Reason: ${order.rejection_reason}`
  notify(order.buyerId, 'Order update', message, 'order', `/orders/track/${order.id}`)
  save()
  return { success: true, message: 'Order updated.' }
})

on('GET', '/distributor/orders/dashboard-stats/', ({ token }) => {
  const hotel = workspaceHotel(requireRole(token, DISTRIBUTOR_SIDE))
  const orders = getDb().orders.filter((order) => order.hotelId === hotel.id)
  const today = localDate()

  const revenue = orders
    .filter((order) => order.status === 'completed' && order.completed_at && localDate(new Date(order.completed_at)) === today)
    .reduce((sum, order) => sum + order.total_amount, 0)

  const trend = Array.from({ length: 7 }, (_, index) => {
    const day = new Date()
    day.setDate(day.getDate() - (6 - index))
    const key = localDate(day)
    const sales = orders
      .filter((order) => order.status === 'completed' && order.completed_at && localDate(new Date(order.completed_at)) === key)
      .reduce((sum, order) => sum + order.total_amount, 0)
    return { day: day.toLocaleDateString(undefined, { weekday: 'short' }), date: key, sales: round2(sales) }
  })

  return {
    today_revenue: round2(revenue),
    active_orders_count: orders.filter((order) => ['placed', 'accepted', 'preparing'].includes(order.status)).length,
    scheduled_orders_count: orders.filter((order) => order.scheduled_date > today && ACTIVE.includes(order.status)).length,
    active_deliveries_count: orders.filter((order) => order.status === 'out_for_delivery').length,
    weekly_sales_trend: trend,
  }
})

on('GET', '/distributor/orders/reports/sales/', ({ token, query }) => {
  const hotel = workspaceHotel(requireRole(token, ['distributor', 'manager']))
  const { start, end } = reportWindow(query.get('start_date') ?? '', query.get('end_date') ?? '')
  return buildReport(hotel, start, end)
})

on('GET', '/distributor/orders/reports/export/', ({ token, query }) => {
  const hotel = workspaceHotel(requireRole(token, ['distributor', 'manager']))
  const { start, end } = reportWindow(query.get('start_date') ?? '', query.get('end_date') ?? '')
  const data = buildReport(hotel, start, end)

  if (query.get('format') === 'pdf') {
    const pdf = new PdfDoc()
    pdf.line(`${hotel.name} - Sales report`, { size: 18, bold: true, advance: 24 })
    pdf.line(`Period: ${start} to ${end}`, { size: 10, advance: 24 })
    ;[
      ['Total sales', data.total_sales.toFixed(2)],
      ['Total orders', String(data.total_orders)],
      ['Average ticket', data.avg_order_value.toFixed(2)],
    ].forEach(([label, value]) => {
      pdf.text(String(label), PAGE.left, pdf.cursor, { bold: true, size: 11 })
      pdf.text(String(value), 260, pdf.cursor, { align: 'right', size: 11 })
      pdf.cursor -= 18
    })

    pdf.gap(10)
    const peak = Math.max(1, ...data.daily_series.map((row) => row.sales))
    const baseline = pdf.cursor - 110
    pdf.text('Daily revenue', PAGE.left, pdf.cursor, { bold: true, size: 11 })
    data.daily_series.forEach((row, index) => {
      const x = PAGE.left + index * 46
      const height = (row.sales / peak) * 96
      pdf.rect(x, baseline, 30, Math.max(height, 1), [0.95, 0.55, 0.15])
      pdf.text(row.date.slice(5), x + 15, baseline - 12, { size: 7, align: 'center' })
    })
    pdf.cursor = baseline - 40

    pdf.line('Top performing items', { size: 11, bold: true, advance: 20 })
    pdf.text('Item', PAGE.left, pdf.cursor, { bold: true, size: 9 })
    pdf.text('Units', 380, pdf.cursor, { bold: true, size: 9, align: 'right' })
    pdf.text('Revenue', 460, pdf.cursor, { bold: true, size: 9, align: 'right' })
    pdf.text('Rating', PAGE.right, pdf.cursor, { bold: true, size: 9, align: 'right' })
    pdf.cursor -= 16
    data.top_items.forEach((row) => {
      pdf.text(row.name.slice(0, 46), PAGE.left, pdf.cursor, { size: 9 })
      pdf.text(String(row.qty_sold), 380, pdf.cursor, { size: 9, align: 'right' })
      pdf.text(row.revenue.toFixed(2), 460, pdf.cursor, { size: 9, align: 'right' })
      pdf.text(row.rating ? row.rating.toFixed(1) : '-', PAGE.right, pdf.cursor, { size: 9, align: 'right' })
      pdf.cursor -= 15
    })
    return pdf.toBlob()
  }

  const rows = [
    [`Sales report - ${hotel.name}`, `${start} to ${end}`],
    [],
    ['Total sales', data.total_sales],
    ['Total orders', data.total_orders],
    ['Average ticket', data.avg_order_value],
    [],
    ['Item', 'Units sold', 'Revenue', 'Rating'],
    ...data.top_items.map((row) => [row.name, row.qty_sold, row.revenue, row.rating]),
    [],
    ['Date', 'Sales'],
    ...data.daily_series.map((row) => [row.date, row.sales]),
  ]
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  return new Blob([csv], { type: 'text/csv' })
})

// --- distributor: staff -----------------------------------------------------

const staffOut = (member: DemoUser) => ({
  id: member.id,
  name: member.name,
  email: member.email,
  phone_number: member.phone_number,
  role: member.role,
  is_active: member.is_active,
})

on('GET', '/distributor/staff/', ({ token }) => {
  const hotel = workspaceHotel(requireRole(token, DISTRIBUTOR_SIDE))
  return getDb()
    .users.filter((user) => user.hotelId === hotel.id)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(staffOut)
})

on('POST', '/distributor/staff/create/', ({ token, body }) => {
  const hotel = workspaceHotel(requireRole(token, ['distributor', 'manager']))
  const db = getDb()
  const email = str(body, 'email').toLowerCase().trim()
  const role = str(body, 'role', 'cook') as Role
  if (!STAFF_ROLES.includes(role)) throw new ApiError(400, 'Staff role must be manager, cook or courier.')
  if (db.users.some((user) => user.email === email)) throw new ApiError(409, 'That email is already registered.')

  const member: DemoUser = {
    id: nextId(),
    email,
    password: str(body, 'password') || 'Staff12345',
    name: str(body, 'name'),
    phone_number: str(body, 'phone_number'),
    role,
    hotelId: hotel.id,
    is_active: true,
  }
  db.users.push(member)
  save()
  return staffOut(member)
})

on('PUT', '/distributor/staff/:id/', ({ token, params, body }) => {
  const hotel = workspaceHotel(requireRole(token, ['distributor', 'manager']))
  const member = getDb().users.find((user) => user.id === Number(params[0]) && user.hotelId === hotel.id)
  if (!member) throw new ApiError(404, 'Staff account not found.')
  member.name = str(body, 'name', member.name)
  member.email = str(body, 'email', member.email).toLowerCase()
  member.phone_number = str(body, 'phone_number')
  member.role = (str(body, 'role', member.role) as Role) || member.role
  if (str(body, 'password')) member.password = str(body, 'password')
  save()
  return staffOut(member)
})

on('POST', '/distributor/staff/:id/toggle/', ({ token, params }) => {
  const hotel = workspaceHotel(requireRole(token, ['distributor', 'manager']))
  const member = getDb().users.find((user) => user.id === Number(params[0]) && user.hotelId === hotel.id)
  if (!member) throw new ApiError(404, 'Staff account not found.')
  member.is_active = !member.is_active
  save()
  return staffOut(member)
})

on('DELETE', '/distributor/staff/:id/', ({ token, params }) => {
  const hotel = workspaceHotel(requireRole(token, ['distributor', 'manager']))
  const db = getDb()
  db.users = db.users.filter((user) => !(user.id === Number(params[0]) && user.hotelId === hotel.id))
  save()
  return { success: true, message: 'Staff account removed.' }
})

// --- admin console ----------------------------------------------------------

const adminHotel = (hotel: DemoHotel) => {
  const owner = getDb().users.find((user) => user.id === hotel.ownerId)
  return {
    id: hotel.id,
    name: hotel.name,
    owner_name: owner?.name ?? '—',
    owner_email: owner?.email ?? '—',
    contact_number: hotel.contact_number,
    address: hotel.place,
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    created_at: hotel.created_at,
    is_verified: hotel.is_verified,
  }
}

on('GET', '/admin/stats/', ({ token }) => {
  requireRole(token, ['admin'])
  const db = getDb()
  return {
    total_users: db.users.filter((user) => user.role === 'customer').length,
    total_hotels: db.hotels.filter((hotel) => hotel.is_verified).length,
    pending_hotels: db.hotels.filter((hotel) => !hotel.is_verified).length,
    total_orders: db.orders.length,
    gross_volume: round2(
      db.orders.filter((order) => order.status === 'completed').reduce((sum, order) => sum + order.total_amount, 0),
    ),
    open_tickets: db.tickets.filter((ticket) => ticket.status !== 'resolved').length,
  }
})

on('GET', '/admin/hotels/pending/', ({ token }) => {
  requireRole(token, ['admin'])
  return getDb().hotels.filter((hotel) => !hotel.is_verified).map(adminHotel)
})

on('GET', '/admin/hotels/', ({ token }) => {
  requireRole(token, ['admin'])
  return getDb().hotels.map(adminHotel)
})

on('POST', '/admin/hotels/:id/verify/', ({ token, params, body }) => {
  requireRole(token, ['admin'])
  const hotel = getDb().hotels.find((entry) => entry.id === Number(params[0]))
  if (!hotel) throw new ApiError(404, 'Hotel not found.')
  const approved = bool(body, 'approved')
  hotel.is_verified = approved
  hotel.rejection_reason = approved ? '' : str(body, 'reason')
  if (approved) hotel.is_online = true
  notify(
    hotel.ownerId,
    approved ? 'Hotel approved' : 'Hotel listing rejected',
    approved
      ? `${hotel.name} is now live on the customer home feed.`
      : hotel.rejection_reason || 'Your listing needs changes before it can go live.',
    'system',
    approved ? '/distributor' : '/distributor/profile',
  )
  save()
  return { success: true, message: approved ? `${hotel.name} approved and published.` : `${hotel.name} was rejected.` }
})

on('GET', '/admin/tickets/', ({ token, query }) => {
  requireRole(token, ['admin'])
  const db = getDb()
  const status = query.get('status') ?? 'open'
  return db.tickets
    .filter((ticket) => (status === 'open' ? ticket.status !== 'resolved' : status === 'all' || ticket.status === status))
    .map((ticket) => {
      const owner = db.users.find((user) => user.id === ticket.userId)
      return {
        ...ticketPayload(ticket),
        user_email: owner?.email ?? '—',
        user_name: owner?.name ?? '—',
      }
    })
})

on('POST', '/admin/tickets/:id/reply/', ({ token, params, body }) => {
  requireRole(token, ['admin'])
  const ticket = getDb().tickets.find((entry) => entry.id === Number(params[0]))
  if (!ticket) throw new ApiError(404, 'Ticket not found.')
  const message = str(body, 'message').trim()
  if (message) ticket.responses.push({ sender: 'Support team', message, timestamp: new Date().toISOString() })
  ticket.status = bool(body, 'close') ? 'resolved' : 'pending'
  ticket.updated_at = new Date().toISOString()
  notify(
    ticket.userId,
    bool(body, 'close') ? 'Ticket resolved' : 'Support replied',
    `Ticket #${ticket.id}: ${message.slice(0, 120) || 'Your ticket was closed.'}`,
    'ticket',
    '/help',
  )
  save()
  return { success: true, message: 'Reply sent.' }
})

on('GET', '/admin/settings/', ({ token }) => {
  requireRole(token, ['admin'])
  return getDb().config
})

on('PUT', '/admin/settings/', ({ token, body }) => {
  requireRole(token, ['admin'])
  const db = getDb()
  db.config.maintenance_mode = bool(body, 'maintenance_mode', db.config.maintenance_mode)
  db.config.maintenance_message = str(body, 'maintenance_message', db.config.maintenance_message) || db.config.maintenance_message
  db.config.allow_registrations = bool(body, 'allow_registrations', db.config.allow_registrations)
  save()
  return db.config
})

on('GET', '/outbox/', ({ token }) => {
  const user = requireUser(token)
  const db = getDb()
  const hotel = db.hotels.find((entry) => entry.ownerId === user.id || entry.id === user.hotelId)

  // Scoped to orders you are a party to: both messages for an order you placed, and
  // both for an order your hotel received. Mail for unrelated orders stays hidden.
  const isMine = (orderId: number) => {
    const order = db.orders.find((entry) => entry.id === orderId)
    if (!order) return false
    return order.buyerId === user.id || (hotel ? order.hotelId === hotel.id : false)
  }

  return db.outbox.filter((message) => message.to === user.email || isMine(message.orderId))
})

on('GET', '/outbox/status/', () => ({
  configured: EMAILJS_CONFIGURED,
  provider: EMAILJS_CONFIGURED ? 'emailjs' : 'demo-outbox',
}))

on('GET', '/public/config/', () => getDb().config)
on('GET', '/health/', () => ({ status: 'ok', mode: 'demo' }))

// ------------------------------------------------------------------ entry ---

/** Simulated latency so loading states are exercised exactly as with a real API. */
const LATENCY = 180

export async function demoRequest(
  method: string,
  path: string,
  body: Record<string, unknown> | null,
  token: string | null,
): Promise<unknown> {
  const [rawPath, rawQuery = ''] = path.split('?')
  const query = new URLSearchParams(rawQuery)

  const match = routes.find(([routeMethod, regex]) => routeMethod === method && regex.test(rawPath))
  await new Promise((resolve) => setTimeout(resolve, LATENCY))

  if (!match) throw new ApiError(404, `No demo handler for ${method} ${rawPath}`)
  const params = (rawPath.match(match[1]) ?? []).slice(1)
  return match[2]({ params, query, body: body ?? {}, token })
}
