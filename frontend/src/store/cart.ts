import { create } from 'zustand'

import type { CartItem, DeliveryType, FoodItem, HotelDetail } from '../lib/types'

const CART_KEY = 'hotelweb.cart'

interface CartSnapshot {
  cartItems: CartItem[]
  hotelId: number | null
  hotelName: string
  scheduledDate: string | null
  scheduledTimeSlot: string | null
  specialInstructions: string
  deliveryType: DeliveryType
  address: string
  latitude: number | null
  longitude: number | null
}

const EMPTY: CartSnapshot = {
  cartItems: [],
  hotelId: null,
  hotelName: '',
  scheduledDate: null,
  scheduledTimeSlot: null,
  specialInstructions: '',
  deliveryType: 'pickup',
  address: '',
  latitude: null,
  longitude: null,
}

const read = (): CartSnapshot => {
  try {
    const raw = localStorage.getItem(CART_KEY)
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as CartSnapshot) } : EMPTY
  } catch {
    return EMPTY
  }
}

interface CartState extends CartSnapshot {
  addToCart: (item: FoodItem, hotel: Pick<HotelDetail, 'id' | 'name'>) => void
  removeFromCart: (itemId: number) => void
  updateQuantity: (itemId: number, quantity: number) => void
  clearCart: () => void
  setSchedule: (date: string, slot: string) => void
  setSpecialInstructions: (text: string) => void
  setDeliveryType: (type: DeliveryType) => void
  setAddress: (address: string, latitude?: number | null, longitude?: number | null) => void
  loadFromHistory: (
    hotelId: number,
    hotelName: string,
    items: { name: string; quantity: number; price: number }[],
    menu: FoodItem[],
  ) => number
  totalItems: () => number
  subtotal: () => number
  maxPrepHours: () => number
}

export const useCartStore = create<CartState>((set, get) => {
  const persist = () => {
    const { cartItems, hotelId, hotelName, scheduledDate, scheduledTimeSlot, specialInstructions, deliveryType, address, latitude, longitude } = get()
    try {
      localStorage.setItem(
        CART_KEY,
        JSON.stringify({ cartItems, hotelId, hotelName, scheduledDate, scheduledTimeSlot, specialInstructions, deliveryType, address, latitude, longitude }),
      )
    } catch {
      /* ignore */
    }
  }

  return {
    ...read(),

    addToCart: (item, hotel) => {
      const state = get()
      // A cart is anchored to one hotel — switching hotels starts a fresh cart.
      const differentHotel = state.hotelId !== null && state.hotelId !== hotel.id
      const base = differentHotel ? [] : state.cartItems
      const existing = base.find((line) => line.id === item.id)

      const cartItems = existing
        ? base.map((line) => (line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line))
        : [
            ...base,
            {
              id: item.id,
              name: item.name,
              price: item.price,
              quantity: 1,
              preparation_time_hours: item.preparation_time_hours,
              is_custom_order: item.is_custom_order,
              image: item.image,
            },
          ]

      set({
        cartItems,
        hotelId: hotel.id,
        hotelName: hotel.name,
        ...(differentHotel ? { scheduledDate: null, scheduledTimeSlot: null } : {}),
      })
      persist()
    },

    removeFromCart: (itemId) => {
      const cartItems = get().cartItems.filter((line) => line.id !== itemId)
      set(cartItems.length ? { cartItems } : { ...EMPTY })
      persist()
    },

    updateQuantity: (itemId, quantity) => {
      if (quantity <= 0) {
        get().removeFromCart(itemId)
        return
      }
      set({ cartItems: get().cartItems.map((line) => (line.id === itemId ? { ...line, quantity } : line)) })
      persist()
    },

    clearCart: () => {
      set({ ...EMPTY })
      persist()
    },

    setSchedule: (date, slot) => {
      set({ scheduledDate: date, scheduledTimeSlot: slot })
      persist()
    },

    setSpecialInstructions: (text) => {
      set({ specialInstructions: text })
      persist()
    },

    setDeliveryType: (type) => {
      set({ deliveryType: type })
      persist()
    },

    setAddress: (address, latitude = null, longitude = null) => {
      set({ address, latitude, longitude })
      persist()
    },

    loadFromHistory: (hotelId, hotelName, items, menu) => {
      const cartItems: CartItem[] = []
      items.forEach((line) => {
        const match = menu.find((entry) => entry.name === line.name && entry.is_available)
        if (!match) return
        cartItems.push({
          id: match.id,
          name: match.name,
          price: match.price,
          quantity: line.quantity,
          preparation_time_hours: match.preparation_time_hours,
          is_custom_order: match.is_custom_order,
          image: match.image,
        })
      })
      set({ ...EMPTY, cartItems, hotelId, hotelName })
      persist()
      return cartItems.length
    },

    totalItems: () => get().cartItems.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: () => Math.round(get().cartItems.reduce((sum, line) => sum + line.price * line.quantity, 0) * 100) / 100,
    maxPrepHours: () => get().cartItems.reduce((max, line) => Math.max(max, line.preparation_time_hours), 0),
  }
})
