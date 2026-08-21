import { create } from 'zustand'

import { api } from '../services/api'
import type { NotificationItem } from '../lib/types'

const SOUND_KEY = 'hotelweb.sound'

interface SoundPrefs {
  enabled: boolean
  volume: number
  tone: 'chime_soft' | 'alert_loud' | 'ping'
}

const readPrefs = (): SoundPrefs => {
  try {
    const raw = localStorage.getItem(SOUND_KEY)
    if (raw) return { enabled: true, volume: 0.6, tone: 'chime_soft', ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { enabled: true, volume: 0.6, tone: 'chime_soft' }
}

/** Tone recipes for the WebAudio chime — no audio assets to ship or 404 on. */
const TONES: Record<SoundPrefs['tone'], { freqs: number[]; duration: number }> = {
  chime_soft: { freqs: [880, 1174.7], duration: 0.18 },
  alert_loud: { freqs: [660, 880, 660, 880], duration: 0.14 },
  ping: { freqs: [1318.5], duration: 0.12 },
}

let audioCtx: AudioContext | null = null

export const playChime = (prefs: SoundPrefs) => {
  if (!prefs.enabled) return
  try {
    audioCtx = audioCtx ?? new AudioContext()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    const recipe = TONES[prefs.tone]
    recipe.freqs.forEach((freq, index) => {
      const osc = audioCtx!.createOscillator()
      const gain = audioCtx!.createGain()
      const start = audioCtx!.currentTime + index * recipe.duration
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(Math.max(prefs.volume, 0.01) * 0.4, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + recipe.duration)
      osc.connect(gain).connect(audioCtx!.destination)
      osc.start(start)
      osc.stop(start + recipe.duration + 0.02)
    })
  } catch {
    /* autoplay blocked until the user interacts — silently skip */
  }
}

interface NotificationState {
  notifications: NotificationItem[]
  unreadCount: number
  sound: SoundPrefs
  fetchNotifications: () => Promise<void>
  markAsRead: (id: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  setSound: (prefs: Partial<SoundPrefs>) => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  sound: readPrefs(),

  fetchNotifications: async () => {
    try {
      const notifications = await api.get<NotificationItem[]>('/notifications/')
      set({ notifications, unreadCount: notifications.filter((item) => !item.is_read).length })
    } catch {
      /* unauthenticated or offline — keep the previous list */
    }
  },

  markAsRead: async (id) => {
    set((state) => ({
      notifications: state.notifications.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }))
    await api.post('/notifications/mark-read/', { notification_ids: [id] })
  },

  markAllAsRead: async () => {
    set((state) => ({
      notifications: state.notifications.map((item) => ({ ...item, is_read: true })),
      unreadCount: 0,
    }))
    await api.post('/notifications/mark-read/', { notification_ids: [] })
  },

  setSound: (prefs) => {
    const sound = { ...get().sound, ...prefs }
    set({ sound })
    try {
      localStorage.setItem(SOUND_KEY, JSON.stringify(sound))
    } catch {
      /* ignore */
    }
  },
}))
