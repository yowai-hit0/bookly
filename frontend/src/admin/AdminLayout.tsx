import { CalendarClock, CalendarDays, ClipboardList, LogOut, Package, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { SkipLink } from '@/components/ui/skip-link'
import { cn } from '@/lib/utils'
import { clearSession, readSession } from './session'

/**
 * Every `/admin/*` page renders inside this. Without a live token it sends him
 * to sign in; this is a convenience, not the protection -- the API refuses the
 * data itself (spec §2.2: no permission is enforced by hiding UI alone).
 *
 * Layout (`design-system/bookly/pages/admin-shell.md`): one navigation
 * element that reflows -- a sidebar from `lg`, a top bar below it -- rather
 * than a drawer, which would need open/close state this branch does not add.
 * DOM order stays wordmark -> links -> sign-out; only `order-*` utilities
 * move sign-out beside the wordmark on the top bar, so tab order is unchanged.
 */

const NAV_ITEMS = [
  { page: 'calendar', icon: CalendarDays },
  { page: 'bookings', icon: ClipboardList },
  { page: 'catalogue', icon: Package },
  { page: 'availability', icon: CalendarClock },
  { page: 'settings', icon: Settings },
] as const

export function AdminLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  if (readSession() === null) return <Navigate to="/admin/login" replace />

  function signOut() {
    clearSession()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-svh lg:flex">
      <SkipLink targetId="admin-content">{t('admin:skipToContent')}</SkipLink>

      <aside className="bg-card flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 lg:sticky lg:top-0 lg:h-svh lg:w-60 lg:shrink-0 lg:flex-col lg:items-stretch lg:gap-1 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:bg-sidebar lg:px-3 lg:py-4">
        <span className="font-heading text-sidebar-foreground order-1 flex items-center gap-2 px-1 text-lg font-semibold">
          {t('common:appName')}
        </span>

        <nav
          aria-label={t('admin:nav.label')}
          className="order-3 flex w-full flex-wrap gap-1 basis-full lg:order-2 lg:w-auto lg:flex-1 lg:basis-auto lg:flex-col"
        >
          {NAV_ITEMS.map(({ page, icon: Icon }) => (
            <NavLink
              key={page}
              to={`/admin/${page}`}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors motion-safe:duration-200 lg:min-h-0',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  'focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none',
                  isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground',
                )
              }
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {t(`admin:nav.${page}`)}
            </NavLink>
          ))}
        </nav>

        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          // `ml-auto` puts it at the right of the top bar's first row
          // (`admin-shell.md`); in the sidebar's column it would push it
          // sideways instead, so it is reset from `lg`.
          className="order-2 ml-auto lg:order-3 lg:mt-auto lg:ml-0 lg:w-full lg:justify-start lg:border-t lg:pt-3"
        >
          <LogOut aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{t('admin:nav.signOut')}</span>
        </Button>
      </aside>

      <div id="admin-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
        <Outlet />
      </div>
    </div>
  )
}
