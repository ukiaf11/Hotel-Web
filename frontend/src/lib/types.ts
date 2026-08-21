export type Role = 'customer' | 'distributor' | 'admin' | 'manager' | 'cook' | 'courier'

export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'out_for_delivery'
  | 'ready_for_pickup'
  | 'completed'
  | 'cancelled'

export type DeliveryType = 'delivery' | 'pickup'

export interface UserProfile {
  id: number
  email: string
  name: string
  role: Role
  phone_number: string
}

export interface AuthResponse {
  access: string
  refresh: string
  user: UserProfile
}

export interface Hotel {
  id: number
  name: string
  place: string
  contact_number: string
  google_map_url: string
  banner_image: string
  cuisine: string
  rating: number
  rating_count: number
  has_delivery: boolean
  is_open: boolean
  avg_delivery_minutes: number
}

export interface HotelDetail extends Hotel {
  description: string
  opening_time: string
  closing_time: string
  latitude: number | null
  longitude: number | null
  min_order_amount: number
  flat_delivery_fee: number
  delivery_radius_km: number
  gallery_images: string[]
  is_online: boolean
  is_verified: boolean
}

export interface FoodItem {
  id: number
  name: string
  description: string
  price: number
  category: string
  image: string
  is_available: boolean
  is_veg: boolean
  is_custom_order: boolean
  preparation_time_hours: number
}

export interface CartItem {
  id: number
  name: string
  price: number
  quantity: number
  preparation_time_hours: number
  is_custom_order: boolean
  image: string
}

export interface Address {
  id: number
  label: string
  address_line: string
  latitude: number | null
  longitude: number | null
  is_default: boolean
}

export interface SlotInfo {
  slot: string
  start: string
  is_full: boolean
  is_past: boolean
  is_enabled: boolean
}

export interface SlotResponse {
  date: string
  operating_hours: { open: string; close: string }
  booked_slots_capacity: SlotInfo[]
}

export interface OrderLine {
  name: string
  quantity: number
  price: number
}

export interface OrderStatusPayload {
  order_id: number
  status: OrderStatus
  eta: string
  delivery_type: DeliveryType
  hotel_name: string
  hotel_phone: string
  hotel_address: string
  hotel_map_url: string
  hotel_coordinates: { lat: number; lng: number } | null
  user_coordinates: { lat: number; lng: number } | null
  user_address: string
  total_amount: number
  payment_method: string
  can_cancel: boolean
  placed_at: string
  accepted_at: string | null
  completed_at: string | null
  items: OrderLine[]
  special_instructions: string
}

export interface OrderHistoryItem {
  id: number
  hotel_id: number
  hotel_name: string
  order_date: string
  scheduled_time: string
  status: OrderStatus
  items_summary: string
  items: OrderLine[]
  total_amount: number
  payment_method: string
  delivery_type: DeliveryType
  can_cancel: boolean
  has_review: boolean
}

export interface QueueCard {
  id: number
  customer_name: string
  customer_phone: string
  items: OrderLine[]
  delivery_type: DeliveryType
  address: string
  scheduled_time: string
  placed_at: string
  total_price: number
  status: OrderStatus
  special_instructions: string
  map_url: string
}

export interface QueueLanes {
  incoming: QueueCard[]
  preparing: QueueCard[]
  ready: QueueCard[]
  completed: QueueCard[]
}

export interface DashboardKPIs {
  today_revenue: number
  active_orders_count: number
  scheduled_orders_count: number
  active_deliveries_count: number
  weekly_sales_trend: { day: string; date: string; sales: number }[]
}

export interface DeliveryConfig {
  has_delivery: boolean
  min_order_amount: number
  flat_delivery_fee: number
  delivery_radius_km: number
  avg_delivery_minutes: number
  active_slots: { morning: boolean; afternoon: boolean; evening: boolean }
}

export interface StaffMember {
  id: number
  name: string
  email: string
  phone_number: string
  role: Extract<Role, 'manager' | 'cook' | 'courier'>
  is_active: boolean
}

export interface TopItem {
  name: string
  qty_sold: number
  revenue: number
  rating: number
}

export interface SalesReport {
  total_sales: number
  avg_order_value: number
  total_orders: number
  top_items: TopItem[]
  daily_series: { date: string; sales: number }[]
}

export interface NotificationItem {
  id: number
  title: string
  body: string
  type: 'order' | 'ticket' | 'system'
  link: string
  is_read: boolean
  created_at: string
}

export interface FAQItem {
  id: number
  question: string
  answer: string
  category: string
}

export interface TicketMessage {
  sender: string
  message: string
  timestamp: string
}

export interface SupportTicket {
  id: number
  subject: string
  message: string
  order_id: number | null
  status: 'open' | 'pending' | 'resolved'
  created_at: string
  updated_at: string
  responses: TicketMessage[]
}

export interface AdminTicket extends SupportTicket {
  user_email: string
  user_name: string
}

export interface PendingHotel {
  id: number
  name: string
  owner_name: string
  owner_email: string
  contact_number: string
  address: string
  latitude: number | null
  longitude: number | null
  created_at: string
  is_verified: boolean
}

export interface PlatformStats {
  total_users: number
  total_hotels: number
  pending_hotels: number
  total_orders: number
  gross_volume: number
  open_tickets: number
}

export interface SiteConfig {
  maintenance_mode: boolean
  maintenance_message: string
  allow_registrations: boolean
}
