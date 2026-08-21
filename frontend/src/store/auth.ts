import { create } from 'zustand'

import { api, setToken } from '../services/api'
import type { AuthResponse, UserProfile } from '../lib/types'

const USER_KEY = 'hotelweb.user'

const readUser = (): UserProfile | null => {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as UserProfile) : null
  } catch {
    return null
  }
}

const persistUser = (user: UserProfile | null) => {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  } catch {
    /* ignore */
  }
}

export interface RegisterPayload {
  name: string
  email: string
  phone: string
  password: string
  role: 'customer' | 'distributor'
  hotel_name?: string
  hotel_address?: string
}

interface AuthState {
  user: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<UserProfile>
  register: (payload: RegisterPayload) => Promise<UserProfile>
  logout: () => void
  hydrate: () => Promise<void>
  updateUser: (user: UserProfile) => void
}

const cached = readUser()

export const useAuthStore = create<AuthState>((set) => ({
  user: cached,
  isAuthenticated: Boolean(cached),
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const data = await api.post<AuthResponse>('/auth/login/', { email, password })
      setToken(data.access)
      persistUser(data.user)
      set({ user: data.user, isAuthenticated: true })
      return data.user
    } finally {
      set({ isLoading: false })
    }
  },

  register: async (payload) => {
    set({ isLoading: true })
    try {
      const data = await api.post<AuthResponse>('/auth/register/', payload)
      setToken(data.access)
      persistUser(data.user)
      set({ user: data.user, isAuthenticated: true })
      return data.user
    } finally {
      set({ isLoading: false })
    }
  },

  logout: () => {
    setToken(null)
    persistUser(null)
    set({ user: null, isAuthenticated: false })
  },

  /** Revalidates the cached session against the API on boot. */
  hydrate: async () => {
    if (!cached) return
    try {
      const user = await api.get<UserProfile>('/auth/me/')
      persistUser(user)
      set({ user, isAuthenticated: true })
    } catch {
      setToken(null)
      persistUser(null)
      set({ user: null, isAuthenticated: false })
    }
  },

  updateUser: (user) => {
    persistUser(user)
    set({ user })
  },
}))

export const isDistributorSide = (role?: string) =>
  ['distributor', 'manager', 'cook', 'courier'].includes(role ?? '')

/** Client-side permission matrix from doc 15. */
export const PERMISSIONS: Record<string, string[]> = {
  distributor: ['dashboard', 'profile', 'menu', 'delivery', 'orders', 'reports', 'staff'],
  manager: ['dashboard', 'profile', 'menu', 'delivery', 'orders', 'reports', 'staff'],
  cook: ['dashboard', 'orders'],
  courier: ['orders'],
}

export const canAccess = (role: string | undefined, section: string) =>
  Boolean(role && (PERMISSIONS[role] ?? []).includes(section))
