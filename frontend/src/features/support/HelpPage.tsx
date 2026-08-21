import { useEffect, useMemo, useState } from 'react'

import { Icon } from '../../components/Icons'
import { Alert, Badge, Button, Card, EmptyState, Select, Skeleton, TextArea, TextInput } from '../../components/ui'
import { relativeTime } from '../../lib/format'
import { errorMessage } from '../../services/errors'
import { useAuthStore } from '../../store/auth'
import { useOrderHistoryStore } from '../../store/orders'
import { useSupportStore } from '../../store/support'
import { useUIStore } from '../../store/ui'

const TICKET_TONE: Record<string, string> = {
  open: 'badge-info',
  pending: 'badge-warning',
  resolved: 'badge-open',
}

export function HelpPage() {
  const { faqs, tickets, isLoading, error, fetchFAQs, fetchTickets, createTicket, replyToTicket, closeTicket } = useSupportStore()
  const { isAuthenticated } = useAuthStore()
  const { history, fetchHistory } = useOrderHistoryStore()
  const { toast, openAuth } = useUIStore()

  const [search, setSearch] = useState('')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [form, setForm] = useState({ subject: '', message: '', order_id: '' })
  const [submitting, setSubmitting] = useState(false)
  const [activeTicket, setActiveTicket] = useState<number | null>(null)
  const [reply, setReply] = useState('')

  useEffect(() => {
    void fetchFAQs()
  }, [fetchFAQs])

  useEffect(() => {
    if (isAuthenticated) {
      void fetchTickets()
      void fetchHistory(1, 'all')
    }
  }, [isAuthenticated, fetchTickets, fetchHistory])

  const visibleFaqs = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return faqs
    return faqs.filter((faq) => faq.question.toLowerCase().includes(query) || faq.answer.toLowerCase().includes(query))
  }, [faqs, search])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isAuthenticated) {
      openAuth('signin')
      return
    }
    if (!form.subject.trim() || !form.message.trim()) {
      toast('warning', 'Subject and message are required')
      return
    }
    setSubmitting(true)
    try {
      await createTicket(form.subject, form.message, form.order_id ? Number(form.order_id) : null)
      setForm({ subject: '', message: '', order_id: '' })
      toast('success', 'Support request submitted', 'Our team will reply in this thread.')
    } catch (submitError) {
      toast('error', 'Could not submit', errorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  const sendReply = async (ticketId: number) => {
    if (!reply.trim()) return
    try {
      await replyToTicket(ticketId, reply)
      setReply('')
    } catch (replyError) {
      toast('error', 'Could not send reply', errorMessage(replyError))
    }
  }

  return (
    <div className="shell section">
      <div className="page-title">
        <h1>Help &amp; support centre</h1>
        <p className="soft">Search the knowledge base, or raise a ticket and we will pick it up from the admin console.</p>
      </div>

      <div className="input-with-icon" style={{ maxWidth: 520, marginBottom: 'var(--space-5)' }}>
        <Icon name="search" size={16} />
        <input className="form-input" placeholder="Search FAQs…" aria-label="Search FAQs" value={search} onChange={(event) => setSearch(event.target.value)} />
        {search ? (
          <button className="input-clear" onClick={() => setSearch('')} aria-label="Clear FAQ search">
            <Icon name="close" size={14} />
          </button>
        ) : null}
      </div>

      <div className="checkout-grid">
        <div className="stack" style={{ gap: 'var(--space-5)' }}>
          <section>
            <h3 style={{ marginBottom: 'var(--space-4)' }}>Frequently asked questions</h3>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            {isLoading ? (
              <div className="stack">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} height={58} />
                ))}
              </div>
            ) : visibleFaqs.length ? (
              visibleFaqs.map((faq) => (
                <div key={faq.id} className="accordion" data-open={openFaq === faq.id}>
                  <button className="accordion-head" aria-expanded={openFaq === faq.id} onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}>
                    <span>
                      {faq.question}
                      <span className="badge tiny" style={{ marginLeft: 8 }}>{faq.category}</span>
                    </span>
                    <span className="accordion-icon">
                      <Icon name={openFaq === faq.id ? 'minus' : 'plus'} size={18} />
                    </span>
                  </button>
                  <div className="accordion-panel">
                    <div>
                      <p>{faq.answer}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState icon="help" title="No matching questions" body="Try another keyword, or raise a ticket and we will answer directly." />
            )}
          </section>

          <Card className="stack">
            <div className="panel-title">
              <h3>Create a support ticket</h3>
            </div>
            {!isAuthenticated ? (
              <Alert tone="info" icon="user">
                <strong>Sign in to raise a ticket</strong>
                We link tickets to your account so support can see your order history.
                <Button size="sm" variant="soft" onClick={() => openAuth('signin')} style={{ marginTop: 8 }}>
                  Sign in
                </Button>
              </Alert>
            ) : null}
            <form className="stack" onSubmit={submit}>
              <TextInput
                label="Subject"
                placeholder="Briefly describe the issue"
                value={form.subject}
                disabled={!isAuthenticated}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
              />
              <Select
                label="Related order (optional)"
                value={form.order_id}
                disabled={!isAuthenticated}
                options={[
                  { value: '', label: 'Not related to a specific order' },
                  ...history.map((order) => ({ value: String(order.id), label: `Order #${order.id} — ${order.hotel_name}` })),
                ]}
                onChange={(event) => setForm({ ...form, order_id: event.target.value })}
              />
              <TextArea
                label="Message"
                placeholder="Tell us what happened…"
                value={form.message}
                disabled={!isAuthenticated}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
              />
              <Button type="submit" variant="primary" icon="send" loading={submitting} disabled={!isAuthenticated} style={{ width: 'fit-content' }}>
                Submit support request
              </Button>
            </form>
          </Card>
        </div>

        <Card className="stack summary-card">
          <div className="panel-title">
            <h3>Your tickets</h3>
            <Badge>{tickets.length}</Badge>
          </div>

          {!isAuthenticated ? (
            <p className="small muted">Sign in to see your support history.</p>
          ) : tickets.length ? (
            <div className="stack" style={{ gap: 'var(--space-3)' }}>
              {tickets.map((ticket) => (
                <div key={ticket.id} className="card" style={{ padding: 'var(--space-3)' }}>
                  <button
                    className="row-between"
                    style={{ width: '100%', background: 'none', border: 0, padding: 0, textAlign: 'left' }}
                    onClick={() => setActiveTicket(activeTicket === ticket.id ? null : ticket.id)}
                    aria-expanded={activeTicket === ticket.id}
                  >
                    <span style={{ minWidth: 0 }}>
                      <strong className="small truncate" style={{ display: 'block' }}>{ticket.subject}</strong>
                      <span className="tiny muted">
                        #{ticket.id}
                        {ticket.order_id ? ` · order #${ticket.order_id}` : ''} · {relativeTime(ticket.updated_at)}
                      </span>
                    </span>
                    <Badge tone={TICKET_TONE[ticket.status]}>{ticket.status}</Badge>
                  </button>

                  {activeTicket === ticket.id ? (
                    <div className="stack" style={{ marginTop: 'var(--space-3)', gap: 'var(--space-2)' }}>
                      <div className="alert alert-info" style={{ display: 'block' }}>
                        <strong className="tiny">You</strong>
                        <p className="small">{ticket.message}</p>
                      </div>
                      {ticket.responses.map((response, index) => (
                        <div key={index} className="card" style={{ padding: 'var(--space-3)', background: 'var(--surface-sunken)' }}>
                          <strong className="tiny">{response.sender}</strong>
                          <p className="small">{response.message}</p>
                          <span className="tiny muted">{relativeTime(response.timestamp)}</span>
                        </div>
                      ))}
                      {ticket.status !== 'resolved' ? (
                        <>
                          <TextArea placeholder="Add more detail…" value={reply} onChange={(event) => setReply(event.target.value)} />
                          <div className="row">
                            <Button size="sm" variant="primary" icon="send" onClick={() => void sendReply(ticket.id)}>
                              Reply
                            </Button>
                            <Button size="sm" variant="ghost" icon="check" onClick={() => void closeTicket(ticket.id)}>
                              Mark resolved
                            </Button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="small muted">No tickets yet — that is a good sign.</p>
          )}
        </Card>
      </div>
    </div>
  )
}
