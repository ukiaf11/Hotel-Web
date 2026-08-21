/** In-browser database for the demo backend. Persisted to localStorage. */

import type { DeliveryType, OrderStatus, Role } from '../../lib/types'
import { SEED_CUSTOMERS, SEED_FAQS, SEED_HOTELS, SEED_STAFF } from './seed'

export const DB_KEY = 'hotelweb.demo.v1'
export const TAX_RATE = 0.05

export interface DemoUser {
  id: number
  email: string
  password: string
  name: string
  phone_number: string
  role: Role
  hotelId: number | null
  is_active: boolean
}

export interface DemoHotel {
  id: number
  ownerId: number
  name: string
  place: string
  contact_number: string
  description: string
  cuisine: string
  banner_image: string
  gallery_images: string[]
  google_map_url: string
  latitude: number | null
  longitude: number | null
  opening_time: string
  closing_time: string
  is_online: boolean
  is_verified: boolean
  rejection_reason: string
  has_delivery: boolean
  min_order_amount: number
  flat_delivery_fee: number
  delivery_radius_km: number
  avg_delivery_minutes: number
  slots: { morning: boolean; afternoon: boolean; evening: boolean }
  rating: number
  rating_count: number
  created_at: string
}

export interface DemoItem {
  id: number
  hotelId: number
  name: string
  description: string
  price: number
  category: string
  image: string
  is_available: boolean
  is_veg: boolean
  is_custom_order: boolean
  preparation_time_hours: number
}

export interface DemoOrderLine {
  food_item_id: number | null
  name: string
  quantity: number
  price: number
}

export interface DemoOrder {
  id: number
  buyerId: number
  hotelId: number
  created_at: string
  updated_at: string
  scheduled_date: string
  scheduled_slot: string
  status: OrderStatus
  delivery_type: DeliveryType
  address: string
  latitude: number | null
  longitude: number | null
  subtotal: number
  delivery_fee: number
  tax_amount: number
  total_amount: number
  payment_method: string
  special_instructions: string
  rejection_reason: string
  accepted_at: string | null
  completed_at: string | null
  lines: DemoOrderLine[]
}

export interface DemoAddress {
  id: number
  userId: number
  label: string
  address_line: string
  latitude: number | null
  longitude: number | null
  is_default: boolean
}

export interface DemoNotification {
  id: number
  userId: number
  title: string
  body: string
  type: 'order' | 'ticket' | 'system'
  link: string
  is_read: boolean
  created_at: string
}

export interface DemoTicket {
  id: number
  userId: number
  subject: string
  message: string
  orderId: number | null
  status: 'open' | 'pending' | 'resolved'
  created_at: string
  updated_at: string
  responses: { sender: string; message: string; timestamp: string }[]
}

export interface DemoReview {
  id: number
  orderId: number
  hotelId: number
  authorId: number
  rating: number
  comment: string
  created_at: string
}

export interface DemoDb {
  seq: number
  users: DemoUser[]
  hotels: DemoHotel[]
  items: DemoItem[]
  categories: { id: number; hotelId: number; name: string; position: number }[]
  orders: DemoOrder[]
  reviews: DemoReview[]
  addresses: DemoAddress[]
  notifications: DemoNotification[]
  faqs: { id: number; question: string; answer: string; category: string }[]
  tickets: DemoTicket[]
  config: { maintenance_mode: boolean; maintenance_message: string; allow_registrations: boolean }
  sessions: Record<string, number>
}

let db: DemoDb | null = null

const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString()
const HOUR = 3600_000
const DAY = 24 * HOUR

/** Deterministic pseudo-random so the demo dataset looks the same on every load. */
const makeRandom = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}

const round2 = (value: number) => Math.round(value * 100) / 100

export const priceLines = (
  lines: { price: number; quantity: number }[],
  fee: number,
  deliveryType: DeliveryType,
) => {
  const subtotal = round2(lines.reduce((sum, line) => sum + line.price * line.quantity, 0))
  const delivery_fee = deliveryType === 'delivery' ? round2(fee) : 0
  const tax_amount = round2(subtotal * TAX_RATE)
  return {
    subtotal,
    delivery_fee,
    tax_amount,
    total_amount: round2(subtotal + delivery_fee + tax_amount),
  }
}

function build(): DemoDb {
  const next = (() => {
    let n = 0
    return () => ++n
  })()

  const data: DemoDb = {
    seq: 0,
    users: [],
    hotels: [],
    items: [],
    categories: [],
    orders: [],
    reviews: [],
    addresses: [],
    notifications: [],
    faqs: [],
    tickets: [],
    config: {
      maintenance_mode: false,
      maintenance_message: 'System undergoing maintenance. New orders are temporarily paused.',
      allow_registrations: true,
    },
    sessions: {},
  }

  data.users.push({
    id: next(),
    email: 'admin@hotelexpress.dev',
    password: 'Admin1234',
    name: 'Platform Admin',
    phone_number: '+919800000000',
    role: 'admin',
    hotelId: null,
    is_active: true,
  })

  SEED_HOTELS.forEach((spec) => {
    const owner: DemoUser = {
      id: next(),
      email: spec.email,
      password: 'Distributor1',
      name: spec.owner,
      phone_number: spec.phone,
      role: 'distributor',
      hotelId: null,
      is_active: true,
    }
    data.users.push(owner)

    const hotel: DemoHotel = {
      id: next(),
      ownerId: owner.id,
      name: spec.name,
      place: spec.place,
      contact_number: spec.phone,
      description: `${spec.cuisine} served fresh at ${spec.place}.`,
      cuisine: spec.cuisine,
      banner_image: spec.banner,
      gallery_images: spec.menu.slice(0, 3).map((entry) => entry.image),
      google_map_url: '',
      latitude: spec.lat,
      longitude: spec.lng,
      opening_time: spec.open,
      closing_time: spec.close,
      is_online: true,
      is_verified: spec.verified,
      rejection_reason: '',
      has_delivery: spec.delivery,
      min_order_amount: spec.minOrder,
      flat_delivery_fee: spec.fee,
      delivery_radius_km: spec.radius,
      avg_delivery_minutes: spec.avgMinutes,
      slots: { morning: true, afternoon: true, evening: true },
      rating: spec.rating,
      rating_count: spec.ratingCount,
      created_at: iso(-40 * DAY),
    }
    data.hotels.push(hotel)

    const categories = [...new Set(spec.menu.map((entry) => entry.category))]
    categories.forEach((name, position) =>
      data.categories.push({ id: next(), hotelId: hotel.id, name, position }),
    )

    spec.menu.forEach((entry) =>
      data.items.push({
        id: next(),
        hotelId: hotel.id,
        name: entry.name,
        description: entry.description,
        price: entry.price,
        category: entry.category,
        image: entry.image,
        is_available: true,
        is_veg: entry.veg,
        is_custom_order: entry.custom,
        preparation_time_hours: entry.prep,
      }),
    )
  })

  const firstHotel = data.hotels[0]
  SEED_STAFF.forEach((member) =>
    data.users.push({
      id: next(),
      email: member.email,
      password: 'Staff12345',
      name: member.name,
      phone_number: '+919700000000',
      role: member.role,
      hotelId: firstHotel.id,
      is_active: true,
    }),
  )

  const customers: DemoUser[] = SEED_CUSTOMERS.map((spec) => {
    const user: DemoUser = {
      id: next(),
      email: spec.email,
      password: 'Customer1',
      name: spec.name,
      phone_number: spec.phone,
      role: 'customer',
      hotelId: null,
      is_active: true,
    }
    data.users.push(user)
    data.addresses.push({
      id: next(),
      userId: user.id,
      label: 'Home',
      address_line: spec.address,
      latitude: spec.lat,
      longitude: spec.lng,
      is_default: true,
    })
    return user
  })

  SEED_FAQS.forEach(([question, answer, category]) =>
    data.faqs.push({ id: next(), question, answer, category }),
  )

  // --- order history -------------------------------------------------------
  const random = makeRandom(42)
  const plan: [OrderStatus, number][] = [
    ['completed', 22], ['completed', 18], ['completed', 14], ['completed', 9],
    ['completed', 6], ['completed', 4], ['completed', 3], ['completed', 2],
    ['completed', 1], ['completed', 0], ['cancelled', 7], ['preparing', 0],
    ['placed', 0], ['out_for_delivery', 0], ['ready_for_pickup', 0],
  ]
  const verified = data.hotels.filter((hotel) => hotel.is_verified)

  plan.forEach(([status, daysAgo], index) => {
    const hotel = verified[index % verified.length]
    const buyer = customers[index % customers.length]
    const menu = data.items.filter((entry) => entry.hotelId === hotel.id && !entry.is_custom_order)
    if (!menu.length) return

    const picks = menu.slice(0, 1 + Math.floor(random() * Math.min(3, menu.length)))
    const lines: DemoOrderLine[] = picks.map((entry) => ({
      food_item_id: entry.id,
      name: entry.name,
      quantity: 1 + Math.floor(random() * 3),
      price: entry.price,
    }))
    const deliveryType: DeliveryType = hotel.has_delivery && index % 2 === 0 ? 'delivery' : 'pickup'
    const totals = priceLines(lines, hotel.flat_delivery_fee, deliveryType)
    const createdMs = Date.now() - daysAgo * DAY - (1 + Math.floor(random() * 8)) * HOUR
    const address = data.addresses.find((entry) => entry.userId === buyer.id)
    const scheduled = new Date(createdMs + 2 * HOUR)

    data.orders.push({
      id: next(),
      buyerId: buyer.id,
      hotelId: hotel.id,
      created_at: new Date(createdMs).toISOString(),
      updated_at: new Date(createdMs + HOUR).toISOString(),
      scheduled_date: scheduled.toLocaleDateString('en-CA'),
      scheduled_slot: '13:00-13:30',
      status,
      delivery_type: deliveryType,
      address: deliveryType === 'delivery' ? address?.address_line ?? '' : '',
      latitude: address?.latitude ?? null,
      longitude: address?.longitude ?? null,
      ...totals,
      payment_method: 'offline',
      special_instructions: index % 4 === 0 ? 'Please keep the spice level mild.' : '',
      rejection_reason: '',
      accepted_at: status === 'placed' ? null : new Date(createdMs + 4 * 60000).toISOString(),
      completed_at: status === 'completed' ? new Date(createdMs + HOUR).toISOString() : null,
      lines,
    })
  })

  data.orders
    .filter((order) => order.status === 'completed')
    .slice(0, 4)
    .forEach((order, index) =>
      data.reviews.push({
        id: next(),
        orderId: order.id,
        hotelId: order.hotelId,
        authorId: order.buyerId,
        rating: index % 3 === 0 ? 4 : 5,
        comment: 'Food arrived hot and exactly on schedule.',
        created_at: order.completed_at ?? iso(),
      }),
    )

  const jane = customers[0]
  const ticketId = next()
  data.tickets.push({
    id: ticketId,
    userId: jane.id,
    subject: 'Order arrived later than the selected slot',
    message: 'My order was scheduled for 13:00 but arrived at 13:40. Could you look into it?',
    orderId: data.orders.find((order) => order.buyerId === jane.id)?.id ?? null,
    status: 'pending',
    created_at: iso(-2 * DAY),
    updated_at: iso(-1 * DAY),
    responses: [
      {
        sender: 'Support team',
        message:
          "Thanks for flagging this — we've contacted the hotel and are checking their dispatch log.",
        timestamp: iso(-1 * DAY),
      },
    ],
  })

  data.notifications.push(
    {
      id: next(),
      userId: jane.id,
      title: 'Welcome to Hotel Express',
      body: 'Browse hotels near you and schedule your first order.',
      type: 'system',
      link: '/',
      is_read: false,
      created_at: iso(-3 * HOUR),
    },
    {
      id: next(),
      userId: jane.id,
      title: 'Support replied',
      body: 'We are checking the dispatch log with the hotel.',
      type: 'ticket',
      link: '/help',
      is_read: false,
      created_at: iso(-1 * DAY),
    },
  )

  const owner = data.users.find((user) => user.id === firstHotel.ownerId)
  if (owner) {
    const incoming = data.orders.find((order) => order.status === 'placed')
    data.notifications.push({
      id: next(),
      userId: owner.id,
      title: 'New order received',
      body: incoming ? `Order #${incoming.id} is awaiting confirmation.` : 'Your workspace is ready.',
      type: 'order',
      link: '/distributor/orders',
      is_read: false,
      created_at: iso(-25 * 60000),
    })
  }

  data.seq = 100000
  return data
}

export function getDb(): DemoDb {
  if (db) return db
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      db = JSON.parse(raw) as DemoDb
      return db
    }
  } catch {
    /* corrupt payload — fall through and rebuild */
  }
  db = build()
  save()
  return db
}

export function save() {
  if (!db) return
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    /* storage full or blocked — the session still works in memory */
  }
}

export function resetDb() {
  db = build()
  save()
  return db
}

export function nextId(): number {
  const data = getDb()
  data.seq += 1
  return data.seq
}
