import { useEffect, useState } from 'react'

import { Alert, Badge, Button, Card, EmptyState, Modal, Select, Skeleton, TextInput, Toggle } from '../../components/ui'
import { initials } from '../../lib/format'
import type { StaffMember } from '../../lib/types'
import { errorMessage } from '../../services/errors'
import { useStaffStore } from '../../store/distributor'
import { useUIStore } from '../../store/ui'

const ROLES = [
  { value: 'manager', label: 'Manager — full hotel control' },
  { value: 'cook', label: 'Kitchen staff — queue only' },
  { value: 'courier', label: 'Delivery agent — dispatch only' },
]

const ROLE_TONE: Record<string, string> = {
  manager: 'badge-brand',
  cook: 'badge-warning',
  courier: 'badge-info',
}

const BLANK = { name: '', email: '', phone_number: '', password: '', role: 'cook' }

export function StaffPage() {
  const { staffList, isLoading, error, fetchStaff, saveStaff, toggleStaffStatus, deleteStaff } = useStaffStore()
  const { toast, askConfirm } = useUIStore()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [draft, setDraft] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    void fetchStaff()
  }, [fetchStaff])

  const open = (member?: StaffMember) => {
    setEditing(member ?? null)
    setDraft(
      member
        ? { name: member.name, email: member.email, phone_number: member.phone_number, password: '', role: member.role }
        : BLANK,
    )
    setFormError('')
    setModalOpen(true)
  }

  const save = async () => {
    if (!draft.name.trim() || !draft.email.trim()) {
      setFormError('Name and email are required.')
      return
    }
    if (!editing && draft.password.length < 8) {
      setFormError('Set a password of at least 8 characters for the new account.')
      return
    }
    setSaving(true)
    try {
      await saveStaff({ ...draft }, editing?.id)
      toast('success', editing ? 'Staff account updated' : 'Staff account created')
      setModalOpen(false)
    } catch (saveError) {
      setFormError(errorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <Card className="stack">
        <div className="panel-title">
          <h3>Staff accounts</h3>
          <Button size="sm" variant="primary" icon="plus" onClick={() => open()}>
            Add staff account
          </Button>
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        {isLoading ? (
          <Skeleton height={200} />
        ) : staffList.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Login email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {staffList.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <span className="row" style={{ gap: 'var(--space-2)' }}>
                        <span className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{initials(member.name)}</span>
                        <strong>{member.name}</strong>
                      </span>
                    </td>
                    <td className="muted">{member.email}</td>
                    <td className="muted">{member.phone_number || '—'}</td>
                    <td>
                      <Badge tone={ROLE_TONE[member.role]}>{member.role}</Badge>
                    </td>
                    <td>
                      <Toggle checked={member.is_active} onChange={() => void toggleStaffStatus(member.id)} label={member.is_active ? 'Active' : 'Suspended'} />
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                        <Button size="sm" variant="secondary" icon="edit" onClick={() => open(member)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="trash"
                          onClick={() =>
                            askConfirm({
                              title: `Remove ${member.name}?`,
                              body: 'Their login is revoked immediately. This cannot be undone.',
                              confirmLabel: 'Remove account',
                              danger: true,
                              onConfirm: async () => {
                                await deleteStaff(member.id)
                                toast('success', 'Staff account removed')
                              },
                            })
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="users"
            title="No sub-accounts yet"
            body="Create logins for your manager, kitchen staff and delivery agents — each gets a scoped workspace."
            action={<Button variant="primary" icon="plus" onClick={() => open()}>Add your first staff account</Button>}
          />
        )}
      </Card>

      <Card className="stack">
        <div className="panel-title">
          <h3>Role permission matrix</h3>
        </div>
        <div className="split-3">
          <Card className="stack" style={{ background: 'var(--surface-sunken)' }}>
            <Badge tone="badge-brand">Manager</Badge>
            <p className="small muted">Full hotel control: profile, menu editor, logistics setup, order queue, reports and staff.</p>
          </Card>
          <Card className="stack" style={{ background: 'var(--surface-sunken)' }}>
            <Badge tone="badge-warning">Kitchen staff</Badge>
            <p className="small muted">Dashboard and order queue only. Cannot alter menu pricing, logistics or view sales reports.</p>
          </Card>
          <Card className="stack" style={{ background: 'var(--surface-sunken)' }}>
            <Badge tone="badge-info">Delivery agent</Badge>
            <p className="small muted">Order queue for dispatch tasks: view delivery locations, mark orders dispatched and completed.</p>
          </Card>
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit staff account' : 'Add a staff account'}>
        <div className="stack">
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          <TextInput label="Full name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          <TextInput label="Username / email" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
          <TextInput label="Phone number" value={draft.phone_number} onChange={(event) => setDraft({ ...draft, phone_number: event.target.value })} />
          <TextInput
            label={editing ? 'New password (leave blank to keep current)' : 'Password'}
            type="password"
            value={draft.password}
            onChange={(event) => setDraft({ ...draft, password: event.target.value })}
          />
          <Select label="Role" value={draft.role} options={ROLES} onChange={(event) => setDraft({ ...draft, role: event.target.value })} />
          <Button variant="primary" block loading={saving} onClick={() => void save()}>
            {editing ? 'Save changes' : 'Create account'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
