import { create } from 'zustand'

import { api } from '../services/api'
import { errorMessage } from '../services/errors'
import type { AdminTicket, PendingHotel, PlatformStats, SiteConfig } from '../lib/types'

interface AdminState {
  stats: PlatformStats | null
  pendingHotels: PendingHotel[]
  allHotels: PendingHotel[]
  openTickets: AdminTicket[]
  config: SiteConfig | null
  isLoading: boolean
  error: string
  fetchAll: () => Promise<void>
  verifyHotel: (id: number, approved: boolean, reason?: string) => Promise<void>
  replyToTicket: (id: number, message: string, close?: boolean) => Promise<void>
  saveConfig: (config: SiteConfig) => Promise<void>
}

export const useAdminStore = create<AdminState>((set, get) => ({
  stats: null,
  pendingHotels: [],
  allHotels: [],
  openTickets: [],
  config: null,
  isLoading: true,
  error: '',

  fetchAll: async () => {
    set({ isLoading: true, error: '' })
    try {
      const [stats, pendingHotels, allHotels, openTickets, config] = await Promise.all([
        api.get<PlatformStats>('/admin/stats/'),
        api.get<PendingHotel[]>('/admin/hotels/pending/'),
        api.get<PendingHotel[]>('/admin/hotels/'),
        api.get<AdminTicket[]>('/admin/tickets/?status=open'),
        api.get<SiteConfig>('/admin/settings/'),
      ])
      set({ stats, pendingHotels, allHotels, openTickets, config, isLoading: false })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
    }
  },

  verifyHotel: async (id, approved, reason = '') => {
    await api.post(`/admin/hotels/${id}/verify/`, { approved, reason })
    await get().fetchAll()
  },

  replyToTicket: async (id, message, close = false) => {
    await api.post(`/admin/tickets/${id}/reply/`, { message, close })
    await get().fetchAll()
  },

  saveConfig: async (config) => {
    set({ config: await api.put<SiteConfig>('/admin/settings/', { ...config }) })
  },
}))
