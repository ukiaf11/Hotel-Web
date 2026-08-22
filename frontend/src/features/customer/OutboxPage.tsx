import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Icon } from '../../components/Icons'
import { Alert, Badge, Button, Card, EmptyState, Skeleton } from '../../components/ui'
import { relativeTime } from '../../lib/format'
import { api, IS_DEMO } from '../../services/api'
import { errorMessage } from '../../services/errors'

interface OutboxMessage {
  id: number
  orderId: number
  kind: 'distributor' | 'customer'
  to: string
  toName: string
  replyTo: string
  subject: string
  body: string
  status: 'sent' | 'recorded' | 'failed'
  provider: 'emailjs' | 'demo-outbox'
  created_at: string
}

const STATUS_TONE: Record<string, string> = {
  sent: 'badge-open',
  recorded: 'badge-info',
  failed: 'badge-closed',
}

/**
 * Demo-only view of the order emails the app has produced. On a real deployment the
 * Django backend sends these over SMTP; here they are composed identically and either
 * delivered through EmailJS or recorded so the behaviour stays inspectable.
 */
export function OutboxPage() {
  const [messages, setMessages] = useState<OutboxMessage[]>([])
  const [status, setStatus] = useState<{ configured: boolean; provider: string } | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get<OutboxMessage[]>('/outbox/'),
      api.get<{ configured: boolean; provider: string }>('/outbox/status/'),
    ])
      .then(([list, config]) => {
        setMessages(list)
        setStatus(config)
      })
      .catch((fetchError) => setError(errorMessage(fetchError)))
      .finally(() => setIsLoading(false))
  }, [])

  if (!IS_DEMO) {
    return (
      <div className="shell section">
        <EmptyState
          icon="message"
          title="Outbox is a demo-mode view"
          body="This build talks to the Django API, which sends order email over SMTP. Check your mail provider's logs instead."
          action={<Link className="btn btn-primary" to="/">Back to home feed</Link>}
        />
      </div>
    )
  }

  return (
    <div className="shell section">
      <div className="page-title">
        <h1>Order email outbox</h1>
        <p className="soft">
          Every order sends a kitchen ticket to the distributor and a confirmation to the customer.
        </p>
      </div>

      {status && !status.configured ? (
        <Alert tone="info" icon="info">
          <strong>No mail provider configured, so nothing left your browser</strong>
          These are the exact messages that would be delivered. Set{' '}
          <code className="mono">VITE_EMAILJS_SERVICE_ID</code>,{' '}
          <code className="mono">VITE_EMAILJS_TEMPLATE_ID</code> and{' '}
          <code className="mono">VITE_EMAILJS_PUBLIC_KEY</code> to send them for real, or run the
          Django backend, which delivers them over SMTP.
        </Alert>
      ) : status?.configured ? (
        <Alert tone="success" icon="checkCircle">
          <strong>Sending live through EmailJS</strong>
          Messages below were delivered to real inboxes.
        </Alert>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {isLoading ? (
        <div className="stack" style={{ marginTop: 'var(--space-4)' }}>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} height={92} radius={14} />
          ))}
        </div>
      ) : messages.length ? (
        <div className="stack" style={{ gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
          {messages.map((message) => (
            <Card key={message.id} className="stack" style={{ gap: 'var(--space-2)' }}>
              <div className="row-between wrap">
                <div style={{ minWidth: 0 }}>
                  <strong className="truncate" style={{ display: 'block' }}>{message.subject}</strong>
                  <span className="tiny muted">
                    To {message.toName} &lt;{message.to}&gt; · {relativeTime(message.created_at)}
                  </span>
                </div>
                <div className="row" style={{ gap: 'var(--space-2)' }}>
                  <Badge tone={message.kind === 'distributor' ? 'badge-brand' : 'badge-info'}>
                    {message.kind === 'distributor' ? 'Kitchen ticket' : 'Customer copy'}
                  </Badge>
                  <Badge tone={STATUS_TONE[message.status]}>{message.status}</Badge>
                </div>
              </div>

              <div className="row" style={{ gap: 'var(--space-2)' }}>
                <Link className="link-chip" to={`/orders/track/${message.orderId}`}>
                  <Icon name="package" size={13} /> Order #{message.orderId}
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={expanded === message.id ? 'minus' : 'plus'}
                  onClick={() => setExpanded(expanded === message.id ? null : message.id)}
                >
                  {expanded === message.id ? 'Hide message' : 'Read message'}
                </Button>
              </div>

              {expanded === message.id ? (
                <pre
                  className="mono tiny"
                  style={{
                    margin: 0,
                    padding: 'var(--space-4)',
                    background: 'var(--surface-sunken)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.65,
                  }}
                >
                  {message.body}
                </pre>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="inbox"
          title="No order email yet"
          body="Place an order and both messages will appear here immediately."
          action={<Link className="btn btn-primary" to="/">Browse hotels</Link>}
        />
      )}
    </div>
  )
}
