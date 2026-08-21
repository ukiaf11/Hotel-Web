import { create } from 'zustand'

import { api } from '../services/api'
import { errorMessage } from '../services/errors'
import type { Address, UserProfile } from '../lib/types'

interface ProfileState {
  addresses: Address[]
  isLoading: boolean
  error: string
  fetchAddresses: () => Promise<void>
  addAddress: (payload: Omit<Address, 'id'>) => Promise<void>
  updateAddress: (id: number, payload: Omit<Address, 'id'>) => Promise<void>
  deleteAddress: (id: number) => Promise<void>
  updateProfileDetails: (name: string, phone: string) => Promise<UserProfile>
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  addresses: [],
  isLoading: true,
  error: '',

  fetchAddresses: async () => {
    set({ isLoading: true, error: '' })
    try {
      set({ addresses: await api.get<Address[]>('/auth/addresses/'), isLoading: false })
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false })
    }
  },

  addAddress: async (payload) => {
    await api.post('/auth/addresses/', payload)
    await get().fetchAddresses()
  },

  updateAddress: async (id, payload) => {
    await api.put(`/auth/addresses/${id}/`, payload)
    await get().fetchAddresses()
  },

  deleteAddress: async (id) => {
    await api.del(`/auth/addresses/${id}/`)
    await get().fetchAddresses()
  },

  updateProfileDetails: async (name, phone_number) =>
    api.put<UserProfile>('/auth/profile/update/', { name, phone_number }),

  changePassword: async (old_password, new_password) => {
    await api.post('/auth/profile/password/', { old_password, new_password })
  },
}))
