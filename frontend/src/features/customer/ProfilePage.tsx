import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Icon } from '../../components/Icons'
import { MapPicker } from '../../components/MapPicker'
import { Alert, Badge, Button, Card, EmptyState, Modal, Skeleton, TextArea, TextInput, Toggle } from '../../components/ui'
import { useSyncedState } from '../../hooks/useSyncedState'
import { initials } from '../../lib/format'
import { validatePassword, validatePhone, validateRequired } from '../../lib/validation'
import type { Address } from '../../lib/types'
import { errorMessage } from '../../services/errors'
import { useAuthStore } from '../../store/auth'
import { useProfileStore } from '../../store/profile'
import { useUIStore } from '../../store/ui'

type Tab = 'personal' | 'addresses' | 'security'

const BLANK: Omit<Address, 'id'> = {
  label: 'Home',
  address_line: '',
  latitude: null,
  longitude: null,
  is_default: false,
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { user, updateUser, logout } = useAuthStore()
  const { addresses, isLoading, fetchAddresses, addAddress, updateAddress, deleteAddress, updateProfileDetails, changePassword } = useProfileStore()
  const { toast, askConfirm } = useUIStore()

  const [tab, setTab] = useState<Tab>('personal')
  const [details, setDetails] = useSyncedState(user, (value) => ({
    name: value?.name ?? '',
    phone: value?.phone_number ?? '',
  }))
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({})
  const [savingDetails, setSavingDetails] = useState(false)

  const [editing, setEditing] = useState<Address | null>(null)
  const [draft, setDraft] = useState(BLANK)
  const [modalOpen, setModalOpen] = useState(false)
  const [savingAddress, setSavingAddress] = useState(false)

  const [passwords, setPasswords] = useState({ old_password: '', new_password: '', confirm: '' })
  const [passwordError, setPasswordError] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    void fetchAddresses()
  }, [fetchAddresses])

  const saveDetails = async (event: React.FormEvent) => {
    event.preventDefault()
    const errors = {
      name: validateRequired(details.name, 'Full name'),
      phone: details.phone ? validatePhone(details.phone) : '',
    }
    const cleaned = Object.fromEntries(Object.entries(errors).filter(([, value]) => value))
    setDetailErrors(cleaned)
    if (Object.keys(cleaned).length) return

    setSavingDetails(true)
    try {
      const updated = await updateProfileDetails(details.name, details.phone)
      updateUser(updated)
      toast('success', 'Profile updated')
    } catch (error) {
      toast('error', 'Could not save', errorMessage(error))
    } finally {
      setSavingDetails(false)
    }
  }

  const openAddress = (address?: Address) => {
    setEditing(address ?? null)
    setDraft(address ? { ...address } : { ...BLANK, is_default: addresses.length === 0 })
    setModalOpen(true)
  }

  const saveAddress = async () => {
    if (!draft.address_line.trim()) {
      toast('warning', 'Address line is required')
      return
    }
    setSavingAddress(true)
    try {
      if (editing) await updateAddress(editing.id, draft)
      else await addAddress(draft)
      toast('success', editing ? 'Address updated' : 'Address saved')
      setModalOpen(false)
    } catch (error) {
      toast('error', 'Could not save address', errorMessage(error))
    } finally {
      setSavingAddress(false)
    }
  }

  const removeAddress = (address: Address) =>
    askConfirm({
      title: 'Delete this address?',
      body: 'Are you sure you want to delete this address? This action cannot be undone.',
      confirmLabel: 'Delete address',
      danger: true,
      onConfirm: async () => {
        await deleteAddress(address.id)
        toast('success', 'Address removed')
      },
    })

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    const strength = validatePassword(passwords.new_password)
    if (strength) {
      setPasswordError(strength)
      return
    }
    if (passwords.new_password !== passwords.confirm) {
      setPasswordError('The confirmation does not match your new password.')
      return
    }
    setPasswordError('')
    setSavingPassword(true)
    try {
      await changePassword(passwords.old_password, passwords.new_password)
      setPasswords({ old_password: '', new_password: '', confirm: '' })
      toast('success', 'Password updated')
    } catch (error) {
      setPasswordError(errorMessage(error))
    } finally {
      setSavingPassword(false)
    }
  }

  const TABS: { key: Tab; label: string; icon: 'user' | 'pin' | 'shield' }[] = [
    { key: 'personal', label: 'Personal info', icon: 'user' },
    { key: 'addresses', label: 'Address book', icon: 'pin' },
    { key: 'security', label: 'Security', icon: 'shield' },
  ]

  return (
    <div className="shell workspace">
      <nav className="side-nav" aria-label="Profile sections">
        <div className="row" style={{ padding: 'var(--space-3)', gap: 'var(--space-3)' }}>
          <span className="avatar" style={{ width: 40, height: 40, fontSize: 'var(--text-sm)' }}>{initials(user?.name ?? '')}</span>
          <div style={{ minWidth: 0 }}>
            <strong className="small truncate" style={{ display: 'block' }}>{user?.name}</strong>
            <span className="tiny muted truncate" style={{ display: 'block' }}>{user?.email}</span>
          </div>
        </div>
        {TABS.map((entry) => (
          <button key={entry.key} className={`side-link ${tab === entry.key ? 'active' : ''}`} onClick={() => setTab(entry.key)}>
            <Icon name={entry.icon} size={16} />
            {entry.label}
          </button>
        ))}
        <button
          className="side-link"
          style={{ color: 'var(--status-closed)' }}
          onClick={() => {
            logout()
            navigate('/')
          }}
        >
          <Icon name="logout" size={16} /> Log out
        </button>
      </nav>

      <div className="stack" style={{ gap: 'var(--space-5)' }}>
        {tab === 'personal' ? (
          <Card className="stack">
            <div className="panel-title">
              <h2>Personal information</h2>
              <Badge tone="badge-brand">{user?.role}</Badge>
            </div>
            <form className="stack" onSubmit={saveDetails} noValidate>
              <div className="split-2">
                <TextInput label="Full name" value={details.name} error={detailErrors.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} />
                <TextInput label="Phone number" value={details.phone} error={detailErrors.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} />
              </div>
              <TextInput label="Email address" value={user?.email ?? ''} disabled hint="Your email is your sign-in identity and cannot be changed here." />
              <Button type="submit" variant="primary" loading={savingDetails} style={{ width: 'fit-content' }}>
                Save changes
              </Button>
            </form>
          </Card>
        ) : null}

        {tab === 'addresses' ? (
          <Card className="stack">
            <div className="panel-title">
              <h2>Saved addresses</h2>
              <Button variant="primary" size="sm" icon="plus" onClick={() => openAddress()}>
                Add new address
              </Button>
            </div>

            {isLoading ? (
              <div className="split-2">
                <Skeleton height={120} />
                <Skeleton height={120} />
              </div>
            ) : addresses.length ? (
              <div className="split-2">
                {addresses.map((address) => (
                  <Card key={address.id} className="stack card-hover">
                    <div className="row-between">
                      <strong>{address.label}</strong>
                      {address.is_default ? <Badge tone="badge-open" icon="check">Default</Badge> : null}
                    </div>
                    <p className="small muted">{address.address_line}</p>
                    {address.latitude != null ? (
                      <span className="tiny mono muted">
                        {address.latitude.toFixed(4)}, {address.longitude?.toFixed(4)}
                      </span>
                    ) : (
                      <span className="tiny muted">No coordinates pinned</span>
                    )}
                    <div className="row">
                      <Button size="sm" variant="secondary" icon="edit" onClick={() => openAddress(address)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" icon="trash" onClick={() => removeAddress(address)}>
                        Delete
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="pin"
                title="No saved addresses"
                body="Save an address to speed up checkout — you can pin exact coordinates for the courier."
                action={<Button variant="primary" icon="plus" onClick={() => openAddress()}>Add your first address</Button>}
              />
            )}
          </Card>
        ) : null}

        {tab === 'security' ? (
          <Card className="stack">
            <div className="panel-title">
              <h2>Security</h2>
            </div>
            <form className="stack" onSubmit={savePassword} noValidate style={{ maxWidth: 460 }}>
              <TextInput
                label="Current password"
                type="password"
                autoComplete="current-password"
                value={passwords.old_password}
                onChange={(event) => setPasswords({ ...passwords, old_password: event.target.value })}
              />
              <TextInput
                label="New password"
                type="password"
                autoComplete="new-password"
                hint="At least 8 characters with an uppercase letter and a digit."
                value={passwords.new_password}
                onChange={(event) => setPasswords({ ...passwords, new_password: event.target.value })}
              />
              <TextInput
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                value={passwords.confirm}
                onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
              />
              {passwordError ? <Alert tone="danger">{passwordError}</Alert> : null}
              <Button
                type="submit"
                variant="primary"
                loading={savingPassword}
                disabled={!passwords.old_password || !passwords.new_password || !passwords.confirm}
                style={{ width: 'fit-content' }}
              >
                Update password
              </Button>
            </form>
          </Card>
        ) : null}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit address' : 'Add a new address'}>
        <div className="stack">
          <TextInput label="Label" placeholder="Home, Work, Parents…" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
          <TextArea
            label="Address line"
            placeholder="Flat / building, street, landmark, city"
            value={draft.address_line}
            onChange={(event) => setDraft({ ...draft, address_line: event.target.value })}
          />
          <MapPicker latitude={draft.latitude} longitude={draft.longitude} onPick={(latitude, longitude) => setDraft({ ...draft, latitude, longitude })} />
          <Toggle checked={draft.is_default} onChange={(is_default) => setDraft({ ...draft, is_default })} label="Use as my default checkout address" brand />
          <Button variant="primary" block loading={savingAddress} onClick={() => void saveAddress()}>
            {editing ? 'Save changes' : 'Save address'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
