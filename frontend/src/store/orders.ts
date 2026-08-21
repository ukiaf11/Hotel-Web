import { create } from 'zustand'

import { api } from '../services/api'
import { errorMessage } from '../services/errors'
import type { OrderHistoryItem, OrderStatusPayload } from '../lib/types'

interface ActiveOrderState {
  order: OrderStatusPayload | null
  activeOrders: OrderStatusPayload[]
  isLoading: boolean
  error: string
  fetchOrder: (orderId: number) => Promise<void>
  fetchActive: () => Promise<void>
  startPolling: (orderId: number) => void
  stopPolling: () => void
  cancelOrder: (orderId: number) => Promise<void>
}

let pollTimer: ReturnType<typeof setInterval> | null = null

export const useActiveOrderStore = create<ActiveOrderState>((set, get) => ({
  order: null,
  activeOrders: [],
  isLoading: true,
  error: '',

  fetchOrder: async (orderId) => {
    try {
      const order = await api.get<OrderStatusPayload>(`/orders/${orderId}/status/`)
      set({ order, isLoading: false, error: '' })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
    }
  },

  fetchActive: async () => {
    try {
      set({ activeOrders: await api.get<OrderStatusPayload[]>('/orders/active/') })
    } catch {
      set({ activeOrders: [] })
    }
  },

  /** Doc 05: poll the status endpoint every 10 seconds while the tracker is open. */
  startPolling: (orderId) => {
    get().stopPolling()
    set({ isLoading: true })
    void get().fetchOrder(orderId)
    pollTimer = setInterval(() => void get().fetchOrder(orderId), 10000)
  },

  stopPolling: () => {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
  },

  cancelOrder: async (orderId) => {
    await api.post(`/orders/${orderId}/cancel/`)
    await get().fetchOrder(orderId)
    await get().fetchActive()
  },
}))

interface OrderHistoryState {
  history: OrderHistoryItem[]
  currentPage: number
  totalPages: number
  totalCount: number
  statusFilter: string
  searchQuery: string
  isLoading: boolean
  error: string
  fetchHistory: (page?: number, statusFilter?: string) => Promise<void>
  setSearchQuery: (query: string) => void
  submitReview: (orderId: number, rating: number, comment: string) => Promise<void>
}

export const useOrderHistoryStore = create<OrderHistoryState>((set, get) => ({
  history: [],
  currentPage: 1,
  totalPages: 1,
  totalCount: 0,
  statusFilter: 'all',
  searchQuery: '',
  isLoading: true,
  error: '',

  fetchHistory: async (page = 1, statusFilter = get().statusFilter) => {
    set({ isLoading: true, error: '', statusFilter })
    try {
      const data = await api.get<{
        results: OrderHistoryItem[]
        current_page: number
        total_pages: number
        total_count: number
      }>(`/orders/history/?page=${page}&status=${statusFilter}`)
      set({
        history: data.results,
        currentPage: data.current_page,
        totalPages: data.total_pages,
        totalCount: data.total_count,
        isLoading: false,
      })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false, history: [] })
    }
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  submitReview: async (orderId, rating, comment) => {
    await api.post(`/orders/${orderId}/review/`, { rating, comment })
    await get().fetchHistory(get().currentPage)
  },
}))
