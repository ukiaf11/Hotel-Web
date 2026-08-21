import { useUIStore } from '../store/ui'
import { Icon, type IconName } from './Icons'

const ICONS: Record<string, IconName> = {
  success: 'checkCircle',
  error: 'xCircle',
  warning: 'warning',
  info: 'info',
}

export function Toasts() {
  const toasts = useUIStore((state) => state.toasts)
  const dismiss = useUIStore((state) => state.dismissToast)

  if (!toasts.length) return null
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind}`}>
          <Icon name={ICONS[toast.kind]} size={18} />
          <div className="grow">
            <strong className="small">{toast.title}</strong>
            {toast.body ? <p className="tiny muted">{toast.body}</p> : null}
          </div>
          <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => dismiss(toast.id)} aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
