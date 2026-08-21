import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { ConfirmDialog } from './components/ConfirmDialog'
import { Layout } from './components/Layout'
import { NotificationDrawer } from './components/NotificationDrawer'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Toasts } from './components/Toasts'
import { EmptyState, Skeleton } from './components/ui'
import { AuthModal } from './features/auth/AuthModal'
import { useAuthStore } from './store/auth'
import { useNotificationStore } from './store/notifications'
import { useActiveOrderStore } from './store/orders'

// Customer surface
const HomePage = lazy(() => import('./features/customer/HomePage').then((m) => ({ default: m.HomePage })))
const HotelDetailsPage = lazy(() => import('./features/customer/HotelDetailsPage').then((m) => ({ default: m.HotelDetailsPage })))
const SchedulePage = lazy(() => import('./features/customer/SchedulePage').then((m) => ({ default: m.SchedulePage })))
const CheckoutPage = lazy(() => import('./features/customer/CheckoutPage').then((m) => ({ default: m.CheckoutPage })))
const TrackOrderPage = lazy(() => import('./features/customer/TrackOrderPage').then((m) => ({ default: m.TrackOrderPage })))
const OrderHistoryPage = lazy(() => import('./features/customer/OrderHistoryPage').then((m) => ({ default: m.OrderHistoryPage })))
const ProfilePage = lazy(() => import('./features/customer/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const HelpPage = lazy(() => import('./features/support/HelpPage').then((m) => ({ default: m.HelpPage })))

// Distributor workspace
const DistributorLayout = lazy(() => import('./features/distributor/DistributorLayout').then((m) => ({ default: m.DistributorLayout })))
const DashboardPage = lazy(() => import('./features/distributor/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const HotelProfilePage = lazy(() => import('./features/distributor/HotelProfilePage').then((m) => ({ default: m.HotelProfilePage })))
const MenuPage = lazy(() => import('./features/distributor/MenuPage').then((m) => ({ default: m.MenuPage })))
const DeliveryPage = lazy(() => import('./features/distributor/DeliveryPage').then((m) => ({ default: m.DeliveryPage })))
const QueuePage = lazy(() => import('./features/distributor/QueuePage').then((m) => ({ default: m.QueuePage })))
const ReportsPage = lazy(() => import('./features/distributor/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const StaffPage = lazy(() => import('./features/distributor/StaffPage').then((m) => ({ default: m.StaffPage })))

// Admin
const AdminPage = lazy(() => import('./features/admin/AdminPage').then((m) => ({ default: m.AdminPage })))

const DISTRIBUTOR_ROLES = ['distributor', 'manager', 'cook', 'courier']

function RouteFallback() {
  return (
    <div className="shell section stack">
      <Skeleton height={44} width="42%" />
      <Skeleton height={220} />
      <Skeleton height={180} />
    </div>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

export default function App() {
  const { isAuthenticated, hydrate } = useAuthStore()
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications)
  const fetchActive = useActiveOrderStore((state) => state.fetchActive)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // Keep the header badges fresh while a session is open.
  useEffect(() => {
    if (!isAuthenticated) return
    void fetchNotifications()
    void fetchActive()
    const timer = setInterval(() => {
      void fetchNotifications()
      void fetchActive()
    }, 20000)
    return () => clearInterval(timer)
  }, [isAuthenticated, fetchNotifications, fetchActive])

  return (
    <Layout>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/hotels/:id" element={<HotelDetailsPage />} />
          <Route path="/hotels/:id/schedule" element={<SchedulePage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/help" element={<HelpPage />} />

          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <OrderHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/track/:id"
            element={
              <ProtectedRoute>
                <TrackOrderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/distributor"
            element={
              <ProtectedRoute roles={DISTRIBUTOR_ROLES}>
                <DistributorLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ProtectedRoute section="dashboard"><DashboardPage /></ProtectedRoute>} />
            <Route path="profile" element={<ProtectedRoute section="profile"><HotelProfilePage /></ProtectedRoute>} />
            <Route path="menu" element={<ProtectedRoute section="menu"><MenuPage /></ProtectedRoute>} />
            <Route path="delivery" element={<ProtectedRoute section="delivery"><DeliveryPage /></ProtectedRoute>} />
            <Route path="orders" element={<ProtectedRoute section="orders"><QueuePage /></ProtectedRoute>} />
            <Route path="reports" element={<ProtectedRoute section="reports"><ReportsPage /></ProtectedRoute>} />
            <Route path="staff" element={<ProtectedRoute section="staff"><StaffPage /></ProtectedRoute>} />
          </Route>

          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminPage />
              </ProtectedRoute>
            }
          />

          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route
            path="*"
            element={
              <div className="shell section">
                <EmptyState
                  icon="search"
                  title="404 — page not found"
                  body="The page you were looking for does not exist or has moved."
                  action={
                    <a className="btn btn-primary" href="/">
                      Back to home feed
                    </a>
                  }
                />
              </div>
            }
          />
        </Routes>
      </Suspense>

      <AuthModal />
      <NotificationDrawer />
      <ConfirmDialog />
      <Toasts />
    </Layout>
  )
}
