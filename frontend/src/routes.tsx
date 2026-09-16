import { Navigate, type RouteObject } from 'react-router'
import { AdminLayout } from '@/admin/AdminLayout'
import { Home } from '@/pages/Home'
import { NotFound } from '@/pages/NotFound'
import { AdminCatalogue } from '@/pages/admin/AdminCatalogue'
import { AdminLogin } from '@/pages/admin/AdminLogin'
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
    ],
  },
  { path: '*', element: <NotFound /> },
]
