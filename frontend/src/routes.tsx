import { Navigate, type RouteObject } from 'react-router'
import { AdminLayout } from '@/admin/AdminLayout'
import { Home } from '@/pages/Home'
import { NotFound } from '@/pages/NotFound'
import { AdminCalendar } from '@/pages/admin/AdminCalendar'
import { AdminLogin } from '@/pages/admin/AdminLogin'

/**
 * Plain paths, no locale prefix (plan.md Task 2, spec §7, R-2). A French
 * launch adds routes; it does not restructure these.
 */
export const routes: RouteObject[] = [
  { path: '/', element: <Home /> },
  { path: '/admin/login', element: <AdminLogin /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="calendar" replace /> },
      { path: 'calendar', element: <AdminCalendar /> },
    ],
  },
  { path: '*', element: <NotFound /> },
]
