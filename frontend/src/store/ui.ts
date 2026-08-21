import { create } from 'zustand'

type ToastKind = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  title: string
  body?: string
}

export type AuthModalReason = 'default' | 'checkout'

interface ConfirmRequest {
  title: string
  body: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
}

interface UIState {
  theme: 'light' | 'dark'
  toasts: Toast[]
  authModal: { open: boolean; tab: 'signin' | 'signup'; reason: AuthModalReason }
  notificationsOpen: boolean
  confirm: ConfirmRequest | null
  toggleTheme: () => void
  setTheme: (theme: 'light' | 'dark') => void
  toast: (kind: ToastKind, title: string, body?: string) => void
  dismissToast: (id: number) => void
  openAuth: (tab?: 'signin' | 'signup', reason?: AuthModalReason) => void
  closeAuth: () => void
  setNotificationsOpen: (open: boolean) => void
  askConfirm: (request: ConfirmRequest) => void
  closeConfirm: () => void
}

const THEME_KEY = 'hotelweb.theme'

const readTheme = (): 'light' | 'dark' => {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const applyTheme = (theme: 'light' | 'dark') => {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* ignore */
  }
}

let toastSeq = 0

export const useUIStore = create<UIState>((set, get) => ({
  theme: 'light',
  toasts: [],
  authModal: { open: false, tab: 'signin', reason: 'default' },
  notificationsOpen: false,
  confirm: null,

  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),

  toast: (kind, title, body) => {
    const id = ++toastSeq
    set((state) => ({ toasts: [...state.toasts, { id, kind, title, body }] }))
    setTimeout(() => get().dismissToast(id), 5000)
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),

  openAuth: (tab = 'signin', reason = 'default') => set({ authModal: { open: true, tab, reason } }),
  closeAuth: () => set((state) => ({ authModal: { ...state.authModal, open: false } })),

  setNotificationsOpen: (open) => set({ notificationsOpen: open }),

  askConfirm: (request) => set({ confirm: request }),
  closeConfirm: () => set({ confirm: null }),
}))

/** Called once at boot so the stored/system theme is applied before first paint. */
export const initTheme = () => {
  const theme = readTheme()
  applyTheme(theme)
  useUIStore.setState({ theme })
}
