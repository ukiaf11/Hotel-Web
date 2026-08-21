import { create } from 'zustand'

import { api } from '../services/api'
import { errorMessage } from '../services/errors'
import type {
  DashboardKPIs,
  DeliveryConfig,
  FoodItem,
  HotelDetail,
  QueueLanes,
  SalesReport,
  StaffMember,
} from '../lib/types'

// --- dashboard --------------------------------------------------------------

interface DistributorState {
  kpis: DashboardKPIs | null
  hotel: HotelDetail | null
  isLoading: boolean
  error: string
  fetchKPIs: () => Promise<void>
  fetchHotel: () => Promise<void>
  saveHotel: (payload: Record<string, unknown>) => Promise<void>
  toggleOnlineStatus: () => Promise<boolean>
}

export const useDistributorStore = create<DistributorState>((set, get) => ({
  kpis: null,
  hotel: null,
  isLoading: true,
  error: '',

  fetchKPIs: async () => {
    set({ isLoading: true, error: '' })
    try {
      set({ kpis: await api.get<DashboardKPIs>('/distributor/orders/dashboard-stats/'), isLoading: false })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
    }
  },

  fetchHotel: async () => {
    try {
      set({ hotel: await api.get<HotelDetail>('/distributor/hotel/') })
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },

  saveHotel: async (payload) => {
    set({ hotel: await api.put<HotelDetail>('/distributor/hotel/update/', payload) })
  },

  toggleOnlineStatus: async () => {
    const result = await api.post<{ is_online: boolean }>('/distributor/status/toggle/')
    const hotel = get().hotel
    if (hotel) set({ hotel: { ...hotel, is_online: result.is_online } })
    return result.is_online
  },
}))

// --- menu -------------------------------------------------------------------

interface MenuState {
  categories: string[]
  items: FoodItem[]
  isLoading: boolean
  error: string
  fetchMenu: () => Promise<void>
  saveItem: (item: Partial<FoodItem>, id?: number) => Promise<void>
  deleteItem: (id: number) => Promise<void>
  toggleStock: (id: number) => Promise<void>
  createCategory: (name: string) => Promise<void>
  deleteCategory: (name: string) => Promise<void>
}

export const useMenuStore = create<MenuState>((set, get) => ({
  categories: [],
  items: [],
  isLoading: true,
  error: '',

  fetchMenu: async () => {
    set({ isLoading: true, error: '' })
    try {
      const data = await api.get<{ categories: string[]; items: FoodItem[] }>('/distributor/menu/')
      set({ categories: data.categories, items: data.items, isLoading: false })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
    }
  },

  saveItem: async (item, id) => {
    if (id) await api.put(`/distributor/menu/items/${id}/`, item)
    else await api.post('/distributor/menu/items/', item)
    await get().fetchMenu()
  },

  deleteItem: async (id) => {
    await api.del(`/distributor/menu/items/${id}/`)
    await get().fetchMenu()
  },

  /** Optimistic flip, reverted by a refetch if the API rejects it (doc 11). */
  toggleStock: async (id) => {
    const previous = get().items
    set({ items: previous.map((item) => (item.id === id ? { ...item, is_available: !item.is_available } : item)) })
    try {
      await api.put(`/distributor/menu/items/${id}/toggle-stock/`)
    } catch (error) {
      set({ items: previous })
      throw error
    }
  },

  createCategory: async (name) => {
    await api.post('/distributor/menu/categories/', { name })
    await get().fetchMenu()
  },

  deleteCategory: async (name) => {
    await api.del(`/distributor/menu/categories/${encodeURIComponent(name)}/`)
    await get().fetchMenu()
  },
}))

// --- delivery settings ------------------------------------------------------

interface DeliverySettingsState {
  config: DeliveryConfig | null
  isLoading: boolean
  error: string
  fetchSettings: () => Promise<void>
  saveSettings: (config: DeliveryConfig) => Promise<void>
}

export const useDeliverySettingsStore = create<DeliverySettingsState>((set) => ({
  config: null,
  isLoading: true,
  error: '',

  fetchSettings: async () => {
    set({ isLoading: true, error: '' })
    try {
      set({ config: await api.get<DeliveryConfig>('/distributor/delivery-settings/'), isLoading: false })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
    }
  },

  saveSettings: async (config) => {
    set({ config: await api.put<DeliveryConfig>('/distributor/delivery-settings/update/', config) })
  },
}))

// --- order queue ------------------------------------------------------------

interface QueueState extends QueueLanes {
  isLoading: boolean
  error: string
  fetchQueue: () => Promise<QueueLanes | null>
  updateOrderStatus: (id: number, status: string, reason?: string) => Promise<void>
}

export const useDistributorQueueStore = create<QueueState>((set, get) => ({
  incoming: [],
  preparing: [],
  ready: [],
  completed: [],
  isLoading: true,
  error: '',

  fetchQueue: async () => {
    try {
      const lanes = await api.get<QueueLanes>('/distributor/orders/')
      set({ ...lanes, isLoading: false, error: '' })
      return lanes
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
      return null
    }
  },

  updateOrderStatus: async (id, status, rejection_reason = '') => {
    await api.post(`/distributor/orders/${id}/update-status/`, { status, rejection_reason })
    await get().fetchQueue()
  },
}))

// --- reports ----------------------------------------------------------------

interface ReportsState {
  report: SalesReport | null
  isLoading: boolean
  error: string
  startDate: string
  endDate: string
  fetchAnalytics: (startDate: string, endDate: string) => Promise<void>
}

export const useDistributorReportsStore = create<ReportsState>((set) => ({
  report: null,
  isLoading: true,
  error: '',
  startDate: '',
  endDate: '',

  fetchAnalytics: async (startDate, endDate) => {
    set({ isLoading: true, error: '', startDate, endDate })
    try {
      const report = await api.get<SalesReport>(
        `/distributor/orders/reports/sales/?start_date=${startDate}&end_date=${endDate}`,
      )
      set({ report, isLoading: false })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
    }
  },
}))

// --- staff ------------------------------------------------------------------

interface StaffState {
  staffList: StaffMember[]
  isLoading: boolean
  error: string
  fetchStaff: () => Promise<void>
  saveStaff: (payload: Record<string, unknown>, id?: number) => Promise<void>
  toggleStaffStatus: (id: number) => Promise<void>
  deleteStaff: (id: number) => Promise<void>
}

export const useStaffStore = create<StaffState>((set, get) => ({
  staffList: [],
  isLoading: true,
  error: '',

  fetchStaff: async () => {
    set({ isLoading: true, error: '' })
    try {
      set({ staffList: await api.get<StaffMember[]>('/distributor/staff/'), isLoading: false })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
    }
  },

  saveStaff: async (payload, id) => {
    if (id) await api.put(`/distributor/staff/${id}/`, payload)
    else await api.post('/distributor/staff/create/', payload)
    await get().fetchStaff()
  },

  toggleStaffStatus: async (id) => {
    await api.post(`/distributor/staff/${id}/toggle/`)
    await get().fetchStaff()
  },

  deleteStaff: async (id) => {
    await api.del(`/distributor/staff/${id}/`)
    await get().fetchStaff()
  },
}))
