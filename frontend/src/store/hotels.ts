import { create } from 'zustand'

import { api } from '../services/api'
import { errorMessage } from '../services/errors'
import type { FoodItem, Hotel, HotelDetail, SlotResponse } from '../lib/types'

export const HOME_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'fast_delivery', label: 'Fast delivery' },
  { key: 'top_rated', label: 'Top rated' },
  { key: 'delivery', label: 'Delivery available' },
  { key: 'open_now', label: 'Open now' },
] as const

interface HotelState {
  hotels: Hotel[]
  isLoading: boolean
  error: string
  searchQuery: string
  activeFilter: string
  fetchHotels: () => Promise<void>
  setSearchQuery: (query: string) => void
  setActiveFilter: (filter: string) => void
}

export const useHotelStore = create<HotelState>((set, get) => ({
  hotels: [],
  isLoading: true,
  error: '',
  searchQuery: '',
  activeFilter: 'all',

  fetchHotels: async () => {
    set({ isLoading: true, error: '' })
    const { searchQuery, activeFilter } = get()
    const params = new URLSearchParams()
    if (searchQuery.trim()) params.set('search', searchQuery.trim())
    if (activeFilter !== 'all') params.set('filter_type', activeFilter)
    try {
      const hotels = await api.get<Hotel[]>(`/hotels/${params.toString() ? `?${params}` : ''}`)
      set({ hotels, isLoading: false })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false, hotels: [] })
    }
  },

  setSearchQuery: (searchQuery) => {
    set({ searchQuery })
    void get().fetchHotels()
  },
  setActiveFilter: (activeFilter) => {
    set({ activeFilter })
    void get().fetchHotels()
  },
}))

interface ActiveHotelState {
  hotel: HotelDetail | null
  items: FoodItem[]
  categories: string[]
  isLoading: boolean
  error: string
  slots: SlotResponse | null
  slotsLoading: boolean
  fetchHotel: (id: number) => Promise<void>
  fetchSlots: (id: number, date: string) => Promise<void>
}

export const useActiveHotelStore = create<ActiveHotelState>((set) => ({
  hotel: null,
  items: [],
  categories: [],
  isLoading: true,
  error: '',
  slots: null,
  slotsLoading: false,

  fetchHotel: async (id) => {
    set({ isLoading: true, error: '' })
    try {
      const [hotel, menu] = await Promise.all([
        api.get<HotelDetail>(`/hotels/${id}/`),
        api.get<{ categories: string[]; items: FoodItem[] }>(`/hotels/${id}/menu/`),
      ])
      set({ hotel, items: menu.items, categories: menu.categories, isLoading: false })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false, hotel: null, items: [] })
    }
  },

  fetchSlots: async (id, date) => {
    set({ slotsLoading: true })
    try {
      const slots = await api.get<SlotResponse>(`/hotels/${id}/delivery-slots/?date=${date}`)
      set({ slots, slotsLoading: false })
    } catch {
      set({ slots: null, slotsLoading: false })
    }
  },
}))
