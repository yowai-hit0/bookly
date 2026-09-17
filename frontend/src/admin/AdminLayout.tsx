import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { clearSession, readSession } from './session'

/**
 * Every `/admin/*` page renders inside this. Without a live token it sends him
 * to sign in; this is a convenience, not the protection -- the API refuses the
 * data itself (spec §2.2: no permission is enforced by hiding UI alone).
 */
export function AdminLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  if (readSession() === null) return <Navigate to="/admin/login" replace />

  function signOut() {
    clearSession()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-svh">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <nav className="flex items-center gap-4" aria-label={t('admin:nav.label')}>
          <span className="font-semibold">{t('common:appName')}</span>
          {(['calendar', 'bookings', 'catalogue'] as const).map((page) => (
            <NavLink
              key={page}
              to={`/admin/${page}`}
              className={({ isActive }) => cn('text-sm hover:underline', isActive ? 'font-medium' : 'text-muted-foreground')}
            >
              {t(`admin:nav.${page}`)}
            </NavLink>
          ))}
        </nav>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut />
          {t('admin:nav.signOut')}
        </Button>
      </header>
      <Outlet />
    </div>
  )
}
