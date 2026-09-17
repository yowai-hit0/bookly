import { Navigate, type RouteObject } from 'react-router'
import { AdminLayout } from '@/admin/AdminLayout'
import { Home } from '@/pages/Home'
import { NotFound } from '@/pages/NotFound'
import { AdminBookingDetail } from '@/pages/admin/AdminBookingDetail'
import { AdminBookings } from '@/pages/admin/AdminBookings'
import { AdminCatalogue } from '@/pages/admin/AdminCatalogue'
import { AdminLogin } from '@/pages/admin/AdminLogin'
import { BookingPage } from '@/pages/booking/BookingPage'
import { CheckoutPage } from '@/pages/checkout/CheckoutPage'
import { PaymentProgressPage } from '@/pages/checkout/PaymentProgressPage'
import { ServiceDetail } from '@/pages/services/ServiceDetail'
import { ServiceList } from '@/pages/services/ServiceList'

/**
 * Plain paths, no locale prefix (plan.md Task 2, spec §7, R-2). A French
 * launch adds routes; it does not restructure these.
 */
export const routes: RouteObject[] = [
  { path: '/', element: <Home /> },
  { path: '/services', element: <ServiceList /> },
  { path: '/services/:slug', element: <ServiceDetail /> },
  // The booking fee (plan.md Task 16): pay, then follow the payment until it settles.
  { path: '/checkout/:reference/:token', element: <CheckoutPage /> },
  { path: '/checkout/:reference/:token/payments/:ourRef', element: <PaymentProgressPage /> },
  // The client's own booking, addressed by the token in the path (plan.md Task 18).
  { path: '/booking/:token', element: <BookingPage /> },
  { path: '/booking/:token/payments/:ourRef', element: <PaymentProgressPage /> },
  { path: '/admin/login', element: <AdminLogin /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="calendar" replace /> },
      // Lazy: FullCalendar and Luxon are the heaviest code in the app, and no
      // public visitor should download them (spec §7, initial payload).
      {
        path: 'calendar',
        lazy: async () => ({ Component: (await import('@/pages/admin/AdminCalendar')).AdminCalendar }),
      },
      { path: 'catalogue', element: <AdminCatalogue /> },
      // Bookings: the list and one booking's lifecycle (plan.md Task 19).
      { path: 'bookings', element: <AdminBookings /> },
      { path: 'bookings/:id', element: <AdminBookingDetail /> },
    ],
  },
  { path: '*', element: <NotFound /> },
]
