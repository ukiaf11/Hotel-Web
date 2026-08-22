/**
 * Order email for the serverless demo backend.
 *
 * A browser cannot speak SMTP, so this composes the same two messages the Django
 * backend sends and then either:
 *   - hands them to EmailJS when VITE_EMAILJS_* is configured (real delivery), or
 *   - records them in a local outbox so the feature is still visible and auditable
 *     on the published demo, where no credentials exist.
 */

import type { DemoHotel, DemoOrder, DemoUser, OutboxMessage } from './db'

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID ?? ''
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? ''
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY ?? ''

export const EMAILJS_CONFIGURED = Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY)

const money = (value: number) => `$${value.toFixed(2)}`

const appOrigin = () =>
  typeof window === 'undefined'
    ? ''
    : `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, '')

const mapUrl = (lat: number | null, lng: number | null) =>
  lat != null && lng != null ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : ''

interface Composed {
  kind: OutboxMessage['kind']
  to: string
  toName: string
  subject: string
  body: string
  replyTo: string
}

export function composeDistributorEmail(
  order: DemoOrder,
  hotel: DemoHotel,
  owner: DemoUser,
  buyer: DemoUser,
): Composed {
  const isDelivery = order.delivery_type === 'delivery'
  const itemCount = order.lines.reduce((sum, line) => sum + line.quantity, 0)
  const customerMap = mapUrl(order.latitude, order.longitude)

  const body = [
    `NEW ORDER #${order.id} - ${hotel.name}`,
    '='.repeat(50),
    '',
    `Placed:      ${new Date(order.created_at).toLocaleString()}`,
    `Scheduled:   ${order.scheduled_date} at ${order.scheduled_slot}`,
    `Fulfilment:  ${isDelivery ? 'Home delivery' : 'Self-pickup'}`,
    '',
    'CUSTOMER',
    '-'.repeat(50),
    `Name:     ${buyer.name}`,
    `Phone:    ${buyer.phone_number || 'not provided'}`,
    `Email:    ${buyer.email}`,
    isDelivery ? `Address:  ${order.address}` : 'Pickup:   customer collects at the counter',
    ...(isDelivery && customerMap ? [`Map:      ${customerMap}`] : []),
    '',
    'FOOD LIST',
    '-'.repeat(50),
    ...order.lines.map(
      (line) =>
        `${line.quantity} x ${line.name} - ${money(line.price * line.quantity)} (${money(line.price)} each)`,
    ),
    '',
    `Subtotal:      ${money(order.subtotal)}`,
    `Delivery fee:  ${money(order.delivery_fee)}`,
    `Tax:           ${money(order.tax_amount)}`,
    `TOTAL:         ${money(order.total_amount)} - collect offline`,
    ...(order.special_instructions
      ? ['', 'CUSTOMER NOTE', '-'.repeat(50), order.special_instructions]
      : []),
    '',
    'Accept or reject this order in your queue:',
    `${appOrigin()}/distributor/orders`,
    '',
    `You are receiving this because you own ${hotel.name} on Hotel Express.`,
  ].join('\n')

  return {
    kind: 'distributor',
    to: owner.email,
    toName: owner.name,
    subject: `New order #${order.id} — ${itemCount} item(s) for ${order.scheduled_slot}`,
    body,
    replyTo: buyer.email,
  }
}

export function composeCustomerEmail(
  order: DemoOrder,
  hotel: DemoHotel,
  owner: DemoUser,
  buyer: DemoUser,
): Composed {
  const isDelivery = order.delivery_type === 'delivery'

  const body = [
    `ORDER #${order.id} CONFIRMED`,
    '='.repeat(50),
    '',
    `Thanks ${buyer.name} - ${hotel.name} has received your order and will`,
    'confirm it shortly.',
    '',
    `Scheduled:   ${order.scheduled_date} at ${order.scheduled_slot}`,
    `Fulfilment:  ${isDelivery ? 'Home delivery' : 'Self-pickup'}`,
    isDelivery ? `Delivering to: ${order.address}` : `Collect from:  ${hotel.place}`,
    '',
    'YOUR ORDER',
    '-'.repeat(50),
    ...order.lines.map((line) => `${line.quantity} x ${line.name} - ${money(line.price * line.quantity)}`),
    '',
    `Subtotal:      ${money(order.subtotal)}`,
    `Delivery fee:  ${money(order.delivery_fee)}`,
    `Tax:           ${money(order.tax_amount)}`,
    `TOTAL:         ${money(order.total_amount)}`,
    '',
    `PAYMENT: offline only. ${
      isDelivery
        ? 'Please have exact change ready for the courier.'
        : 'Please pay at the counter when you collect.'
    }`,
    '',
    `Track your order:  ${appOrigin()}/orders/track/${order.id}`,
    `Hotel:             ${hotel.name}, ${hotel.contact_number || 'no phone on file'}`,
    ...(mapUrl(hotel.latitude, hotel.longitude)
      ? [`Directions:        ${mapUrl(hotel.latitude, hotel.longitude)}`]
      : []),
  ].join('\n')

  return {
    kind: 'customer',
    to: buyer.email,
    toName: buyer.name,
    subject: `Order #${order.id} confirmed — ${hotel.name}`,
    body,
    replyTo: owner.email,
  }
}

async function deliverViaEmailJS(message: Composed, order: DemoOrder): Promise<'sent' | 'failed'> {
  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: SERVICE_ID,
        template_id: TEMPLATE_ID,
        user_id: PUBLIC_KEY,
        template_params: {
          to_email: message.to,
          to_name: message.toName,
          reply_to: message.replyTo,
          subject: message.subject,
          message: message.body,
          order_id: order.id,
          order_total: money(order.total_amount),
        },
      }),
    })
    return response.ok ? 'sent' : 'failed'
  } catch {
    return 'failed'
  }
}

/**
 * Compose and deliver both order emails. Never throws — a mail problem must not
 * cost the customer their order, exactly as on the Django side.
 */
export async function sendOrderEmails(
  order: DemoOrder,
  hotel: DemoHotel,
  owner: DemoUser,
  buyer: DemoUser,
): Promise<Omit<OutboxMessage, 'id'>[]> {
  const drafts = [
    owner.email ? composeDistributorEmail(order, hotel, owner, buyer) : null,
    buyer.email ? composeCustomerEmail(order, hotel, owner, buyer) : null,
  ].filter((draft): draft is Composed => draft !== null)

  const results: Omit<OutboxMessage, 'id'>[] = []
  for (const draft of drafts) {
    const status = EMAILJS_CONFIGURED ? await deliverViaEmailJS(draft, order) : 'recorded'
    results.push({
      ...draft,
      orderId: order.id,
      status,
      provider: EMAILJS_CONFIGURED ? 'emailjs' : 'demo-outbox',
      created_at: new Date().toISOString(),
    })
  }
  return results
}
