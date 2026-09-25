import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router'
import { Button } from '@/components/ui/button'
import { SkipLink } from '@/components/ui/skip-link'

/**
 * The header and footer every client page wears (`design-system/bookly/pages/
 * client-shell.md`). Before this, a client who arrived on `/checkout/...` or
 * `/booking/...` from an email had no route to anything else.
 *
 * The header and footer are **siblings of each page's own `main`**, never a
 * wrapper around it: two `main` elements would break `page.locator('main')` in
 * the e2e suite, and each page's landmark is its own. The container around the
 * outlet is a plain `div`, and it is the skip link's target.
 *
 * No "My booking" link. It was meant to lead to a page where a client re-sends
 * their own magic link, but no public endpoint exists to do it (the only resend
 * is admin-only, behind the session guard). Decided 2026-09-21: ship the header
 * without it rather than invent the endpoint or fake the page.
 */

export function ClientShell() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-svh flex-col">
      <SkipLink targetId="main-content">{t('shell:skipToContent')}</SkipLink>

      <ClientHeader />

      <div id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </div>

      <footer className="bg-card mt-auto border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-heading text-base font-semibold">{t('common:appName')}</span>
            {/* No year, no rights reserved: there is no name to assert them for. */}
            <p className="text-muted-foreground max-w-sm text-sm text-pretty">{t('shell:footer.note')}</p>
          </div>
          <nav aria-label={t('shell:footer.label')}>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                {/* Standalone links, so they take the app's touch height on a coarse pointer. */}
                <Link to="/" className="inline-flex min-h-6 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11">
                  {t('shell:footer.home')}
                </Link>
              </li>
              <li>
                {/* Never named "All services": three e2e specs match that name page-wide. */}
                <Link to="/services" className="inline-flex min-h-6 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11">
                  {t('shell:footer.services')}
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  )
}

/**
 * The client top bar: the wordmark home, the photographer's way into admin,
 * and the one primary action. Also worn by `/admin/login` (decided 2026-09-25),
 * which hides the admin link -- it would point at the page itself.
 *
 * The admin link is a quiet ghost, never a second primary: "Book now" is the
 * action this bar exists for. It is a link, not a button: the e2e suite counts
 * buttons page-wide.
 */
export function ClientHeader({ showAdminLogin = true }: { showAdminLogin?: boolean }) {
  const { t } = useTranslation()

  return (
    // Static, not sticky: a bar that follows the page can obscure focus over
    // the slot picker and the payment form.
    <header className="bg-card border-b">
      <nav
        aria-label={t('shell:nav.label')}
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4"
      >
        <Link
          to="/"
          className="font-heading rounded-sm text-lg font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t('common:appName')}
        </Link>
        <div className="flex items-center gap-2">
          {showAdminLogin && (
            <Button asChild variant="ghost">
              <Link to="/admin/login">{t('shell:nav.adminLogin')}</Link>
            </Button>
          )}
          <Button asChild>
            <Link to="/services">{t('shell:nav.bookNow')}</Link>
          </Button>
        </div>
      </nav>
    </header>
  )
}
