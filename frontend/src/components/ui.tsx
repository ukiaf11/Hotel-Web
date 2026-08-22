import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

import { Icon, type IconName } from './Icons'

type Variant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'success' | 'danger' | 'outline-danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  icon?: IconName
  iconRight?: IconName
  loading?: boolean
  block?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  block = false,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size !== 'md' ? `btn-${size}` : '',
    block ? 'btn-block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <span className="spinner" /> : icon ? <Icon name={icon} size={size === 'sm' ? 14 : 16} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={size === 'sm' ? 14 : 16} /> : null}
    </button>
  )
}

interface FieldProps {
  label?: string
  hint?: string
  error?: string
  children: ReactNode
  htmlFor?: string
}

export function Field({ label, hint, error, children, htmlFor }: FieldProps) {
  return (
    <div className="field">
      {label ? (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </div>
  )
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  icon?: IconName
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, hint, error, icon, className = '', ...rest },
  ref,
) {
  const generatedId = useId()
  const id = rest.id ?? generatedId
  const input = (
    <input
      ref={ref}
      id={id}
      className={`form-input ${error ? 'invalid' : ''} ${className}`}
      aria-invalid={error ? true : undefined}
      {...rest}
    />
  )
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      {icon ? (
        <div className="input-with-icon">
          <Icon name={icon} size={16} />
          {input}
        </div>
      ) : (
        input
      )}
    </Field>
  )
})

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

export function TextArea({ label, hint, error, className = '', ...rest }: TextAreaProps) {
  const generatedId = useId()
  const id = rest.id ?? generatedId
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <textarea id={id} className={`form-input ${error ? 'invalid' : ''} ${className}`} {...rest} />
    </Field>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
  options: { value: string; label: string }[]
}

export function Select({ label, hint, error, options, className = '', ...rest }: SelectProps) {
  const generatedId = useId()
  const id = rest.id ?? generatedId
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <select id={id} className={`form-input ${className}`} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  disabled?: boolean
  brand?: boolean
  id?: string
}

export function Toggle({ checked, onChange, label, disabled, brand, id }: ToggleProps) {
  const generatedId = useId()
  return (
    <label className={`switch ${brand ? 'switch-brand' : ''}`} htmlFor={id ?? generatedId}>
      <input
        id={id ?? generatedId}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch-track" />
      {label ? <span className="small strong">{label}</span> : null}
    </label>
  )
}

export function Badge({
  children,
  tone = '',
  icon,
}: {
  children: ReactNode
  tone?: string
  icon?: IconName
}) {
  return (
    <span className={`badge ${tone}`}>
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  )
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  pad?: boolean
  as?: 'div' | 'section' | 'article'
}

export function Card({ children, className = '', pad = true, as: Tag = 'div', ...rest }: CardProps) {
  return (
    <Tag className={`card ${pad ? 'card-pad' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

export function Skeleton({ height = 16, width = '100%', radius = 10 }: { height?: number | string; width?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius }} />
}

export function EmptyState({
  icon = 'inbox',
  title,
  body,
  action,
}: {
  icon?: IconName
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <h4>{title}</h4>
      {body ? <p className="small" style={{ maxWidth: '44ch' }}>{body}</p> : null}
      {action}
    </div>
  )
}

export function Stars({
  value,
  size = 14,
  onChange,
}: {
  value: number
  size?: number
  onChange?: (value: number) => void
}) {
  if (!onChange) {
    return (
      <span className="stars" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Icon key={star} name="star" size={size} filled={star <= Math.round(value)} strokeWidth={star <= Math.round(value) ? 0 : 1.6} />
        ))}
      </span>
    )
  }
  return (
    <span className="stars" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={star === value}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          className={star <= value ? 'on' : ''}
          onClick={() => onChange(star)}
        >
          <Icon name="star" size={size + 8} filled={star <= value} strokeWidth={star <= value ? 0 : 1.6} />
        </button>
      ))}
    </span>
  )
}

export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 30,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}) {
  return (
    <div className="qty">
      <button type="button" aria-label="Decrease quantity" disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Icon name="minus" size={14} />
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" aria-label="Increase quantity" disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Icon name="plus" size={14} />
      </button>
    </div>
  )
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: string
  children: ReactNode
  wide?: boolean
  labelledBy?: string
}

export function Modal({ open, onClose, title, subtitle, children, wide }: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const titleId = useId()

  // Callers pass an inline arrow, so `onClose` is a new function on every render.
  // Keeping the latest one in a ref lets the effect below depend on `open` alone.
  useEffect(() => {
    closeRef.current = onClose
  })

  // Runs only when the dialog opens. It must not re-run on every render: it moves
  // focus to the dialog, which would otherwise pull the caret out of an input after
  // each keystroke.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cardRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null
  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={cardRef}
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-head">
          <div>
            {title ? <h3 id={titleId}>{title}</h3> : null}
            {subtitle ? <p className="small muted">{subtitle}</p> : null}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function Alert({
  tone = 'info',
  icon,
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger'
  icon?: IconName
  children: ReactNode
}) {
  const fallback: Record<string, IconName> = {
    info: 'info',
    success: 'checkCircle',
    warning: 'warning',
    danger: 'xCircle',
  }
  return (
    <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon name={icon ?? fallback[tone]} size={18} />
      <div>{children}</div>
    </div>
  )
}

export function Pills({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[]
  value: string
  onChange: (key: string) => void
}) {
  return (
    <div className="pill-group" role="tablist">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          className="pill"
          aria-pressed={value === option.key}
          aria-selected={value === option.key}
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
