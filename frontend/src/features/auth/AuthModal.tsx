import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Icon } from '../../components/Icons'
import { Alert, Button, Modal, TextInput } from '../../components/ui'
import { passwordScore, validateEmail, validatePassword, validatePhone, validateRequired } from '../../lib/validation'
import { IS_DEMO } from '../../services/api'
import { DEMO_ACCOUNTS } from '../../services/demo/seed'
import { errorMessage } from '../../services/errors'
import { useAuthStore } from '../../store/auth'
import { useNotificationStore } from '../../store/notifications'
import { useUIStore } from '../../store/ui'

type Role = 'customer' | 'distributor'

const STRENGTH_LABEL = ['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent']

/**
 * The body is remounted (via `key`) each time the modal opens, so every field,
 * validation error and tab selection resets without an effect.
 */
export function AuthModal() {
  const authModal = useUIStore((state) => state.authModal)
  if (!authModal.open) return null
  return <AuthModalBody key={`${authModal.tab}-${authModal.reason}`} />
}

function AuthModalBody() {
  const { authModal, closeAuth, toast } = useUIStore()
  const { login, register, isLoading } = useAuthStore()
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications)
  const navigate = useNavigate()

  const [tab, setTab] = useState<'signin' | 'signup'>(authModal.tab)
  const [role, setRole] = useState<Role>('customer')
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    hotel_name: '',
    hotel_address: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((state) => ({ ...state, [key]: event.target.value }))
    setErrors((state) => ({ ...state, [key]: '' }))
  }

  const validateField = (key: keyof typeof form) => () => {
    const value = form[key]
    let message = ''
    if (key === 'email') message = validateEmail(value)
    else if (key === 'password' && tab === 'signup') message = validatePassword(value)
    else if (key === 'phone' && tab === 'signup') message = validatePhone(value)
    else if (key === 'name' && tab === 'signup') message = validateRequired(value, 'Full name')
    else if (key === 'hotel_name' && tab === 'signup' && role === 'distributor') {
      message = validateRequired(value, 'Hotel name')
    }
    setErrors((state) => ({ ...state, [key]: message }))
  }

  const dismiss = () => {
    if (authModal.reason === 'checkout') {
      toast('warning', 'Authentication is required to place your order.')
    }
    closeAuth()
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setServerError('')

    const nextErrors: Record<string, string> = { email: validateEmail(form.email) }
    if (tab === 'signup') {
      nextErrors.name = validateRequired(form.name, 'Full name')
      nextErrors.phone = validatePhone(form.phone)
      nextErrors.password = validatePassword(form.password)
      if (role === 'distributor') nextErrors.hotel_name = validateRequired(form.hotel_name, 'Hotel name')
    } else if (!form.password) {
      nextErrors.password = 'Enter your password.'
    }

    const cleaned = Object.fromEntries(Object.entries(nextErrors).filter(([, value]) => value))
    setErrors(cleaned)
    if (Object.keys(cleaned).length) return

    try {
      const user =
        tab === 'signin'
          ? await login(form.email, form.password)
          : await register({
              name: form.name,
              email: form.email,
              phone: form.phone,
              password: form.password,
              role,
              hotel_name: role === 'distributor' ? form.hotel_name : undefined,
              hotel_address: role === 'distributor' ? form.hotel_address : undefined,
            })

      closeAuth()
      void fetchNotifications()
      toast('success', tab === 'signin' ? `Welcome back, ${user.name.split(' ')[0]}` : 'Account created', 
        user.role === 'distributor' ? 'Your listing is queued for admin verification.' : undefined)

      if (user.role === 'admin') navigate('/admin')
      else if (['distributor', 'manager', 'cook', 'courier'].includes(user.role)) navigate('/distributor')
      else if (authModal.reason === 'checkout') navigate('/checkout')
    } catch (error) {
      setServerError(errorMessage(error))
    }
  }

  const quickFill = (email: string, password: string) => {
    setForm((state) => ({ ...state, email, password }))
    setTab('signin')
    setErrors({})
  }

  const score = passwordScore(form.password)

  return (
    <Modal
      open={authModal.open}
      onClose={dismiss}
      title="Welcome to Hotel Express"
      subtitle={tab === 'signin' ? 'Sign in to schedule and track your orders.' : 'Create an account in under a minute.'}
    >
      <div className="stack">
        <div className="tabs" role="tablist">
          <button role="tab" className="tab" aria-selected={tab === 'signin'} onClick={() => setTab('signin')}>
            Sign in
          </button>
          <button role="tab" className="tab" aria-selected={tab === 'signup'} onClick={() => setTab('signup')}>
            Sign up
          </button>
        </div>

        {authModal.reason === 'checkout' ? (
          <Alert tone="info" icon="info">
            Sign in to place your order — your cart and schedule are saved.
          </Alert>
        ) : null}

        {serverError ? <Alert tone="danger">{serverError}</Alert> : null}

        <form className="stack" onSubmit={submit} noValidate>
          {tab === 'signup' ? (
            <>
              <div className="field">
                <span className="field-label">Join as</span>
                <div className="segmented">
                  <button type="button" className="segment" aria-pressed={role === 'customer'} onClick={() => setRole('customer')}>
                    <span className="row" style={{ gap: 6 }}>
                      <Icon name="user" size={16} />
                      <span className="segment-title">Customer</span>
                    </span>
                    <span className="tiny muted">Order and schedule meals</span>
                  </button>
                  <button type="button" className="segment" aria-pressed={role === 'distributor'} onClick={() => setRole('distributor')}>
                    <span className="row" style={{ gap: 6 }}>
                      <Icon name="store" size={16} />
                      <span className="segment-title">Hotel owner</span>
                    </span>
                    <span className="tiny muted">List your kitchen</span>
                  </button>
                </div>
              </div>

              <TextInput
                label="Full name"
                placeholder="Jane Doe"
                autoComplete="name"
                value={form.name}
                onChange={set('name')}
                onBlur={validateField('name')}
                error={errors.name}
              />
            </>
          ) : null}

          <TextInput
            label="Email address"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            icon="message"
            value={form.email}
            onChange={set('email')}
            onBlur={validateField('email')}
            error={errors.email}
          />

          {tab === 'signup' ? (
            <TextInput
              label="Phone number"
              type="tel"
              placeholder="+91 98123 40001"
              autoComplete="tel"
              icon="phone"
              value={form.phone}
              onChange={set('phone')}
              onBlur={validateField('phone')}
              error={errors.phone}
            />
          ) : null}

          <TextInput
            label="Password"
            type="password"
            placeholder={tab === 'signup' ? 'At least 8 characters' : 'Your password'}
            autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
            value={form.password}
            onChange={set('password')}
            onBlur={validateField('password')}
            error={errors.password}
            hint={tab === 'signup' ? 'Must include an uppercase letter and a digit.' : undefined}
          />

          {tab === 'signup' && form.password ? (
            <div>
              <div className="progress">
                <i style={{ width: `${(score / 5) * 100}%`, background: score < 3 ? 'var(--status-closed)' : score < 4 ? 'var(--status-warning)' : 'var(--status-open)' }} />
              </div>
              <span className="tiny muted">Password strength: {STRENGTH_LABEL[score]}</span>
            </div>
          ) : null}

          {tab === 'signup' && role === 'distributor' ? (
            <>
              <TextInput
                label="Hotel / restaurant name"
                placeholder="Royal Palace Kitchen"
                value={form.hotel_name}
                onChange={set('hotel_name')}
                onBlur={validateField('hotel_name')}
                error={errors.hotel_name}
              />
              <TextInput
                label="Contact address"
                placeholder="12 Marine Drive, Downtown"
                value={form.hotel_address}
                onChange={set('hotel_address')}
              />
              <Alert tone="info" icon="shield">
                New listings are reviewed by an administrator before they appear on the home feed.
              </Alert>
            </>
          ) : null}

          <Button type="submit" variant="primary" size="lg" block loading={isLoading}>
            {tab === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        {IS_DEMO ? (
          <div className="stack" style={{ gap: 'var(--space-2)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
            <span className="tiny muted">Demo accounts — one click to fill the form:</span>
            <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
              {DEMO_ACCOUNTS.map((account) => (
                <Button key={account.email} size="sm" variant="soft" onClick={() => quickFill(account.email, account.password)}>
                  {account.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
