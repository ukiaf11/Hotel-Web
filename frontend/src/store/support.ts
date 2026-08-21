import { create } from 'zustand'

import { api } from '../services/api'
import { errorMessage } from '../services/errors'
import type { FAQItem, SupportTicket } from '../lib/types'

interface SupportState {
  faqs: FAQItem[]
  tickets: SupportTicket[]
  isLoading: boolean
  error: string
  fetchFAQs: () => Promise<void>
  fetchTickets: () => Promise<void>
  createTicket: (subject: string, message: string, orderId?: number | null) => Promise<void>
  replyToTicket: (ticketId: number, message: string) => Promise<void>
  closeTicket: (ticketId: number) => Promise<void>
}

export const useSupportStore = create<SupportState>((set, get) => ({
  faqs: [],
  tickets: [],
  isLoading: true,
  error: '',

  fetchFAQs: async () => {
    set({ isLoading: true, error: '' })
    try {
      set({ faqs: await api.get<FAQItem[]>('/support/faqs/'), isLoading: false })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
    }
  },

  fetchTickets: async () => {
    try {
      set({ tickets: await api.get<SupportTicket[]>('/support/tickets/') })
    } catch {
      set({ tickets: [] })
    }
  },

  createTicket: async (subject, message, order_id = null) => {
    await api.post('/support/tickets/create/', { subject, message, order_id })
    await get().fetchTickets()
  },

  replyToTicket: async (ticketId, message) => {
    await api.post(`/support/tickets/${ticketId}/reply/`, { message })
    await get().fetchTickets()
  },

  closeTicket: async (ticketId) => {
    await api.post(`/support/tickets/${ticketId}/close/`)
    await get().fetchTickets()
  },
}))
