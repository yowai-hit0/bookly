import type { RouteObject } from 'react-router'
import { Home } from '@/pages/Home'
import { NotFound } from '@/pages/NotFound'

/**
 * Plain paths, no locale prefix (plan.md Task 2, spec §7, R-2). A French
 * launch adds routes; it does not restructure these.
 */
export const routes: RouteObject[] = [
  { path: '/', element: <Home /> },
  { path: '*', element: <NotFound /> },
]
