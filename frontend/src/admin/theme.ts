import { useCallback, useLayoutEffect, useState } from 'react'

/**
 * The admin's light and dark themes (design-system/bookly/admin-console.md
 * section 1). The default follows the operating system and changes with it
 * live; a System / Light / Dark choice overrides it on this device.
 *
 * The resolved theme is written to `<html data-admin-theme>`, not to a wrapper,
 * because Radix popovers portal into `body` and would miss a wrapper's tokens.
 * It is removed when the admin page unmounts, so a client page opened after the
 * admin carries none of its tokens.
 *
 * Storage can be blocked (a private window, a sandboxed preview), so every
 * read and write is guarded and falls back to following the system.
 */

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark']
export const THEME_STORAGE_KEY = 'bookly.admin.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function isPreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value)
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isPreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function writeThemePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Not remembered on this device; the choice still applies until the page closes.
  }
}

function darkQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null
}

function systemTheme(): ResolvedTheme {
  return darkQuery()?.matches === true ? 'dark' : 'light'
}

export function resolveTheme(preference: ThemePreference, system: ResolvedTheme): ResolvedTheme {
  return preference === 'system' ? system : preference
}

/**
 * Applies the admin theme while the calling page is mounted, and hands back the
 * preference and a setter for the toggle. Both states start from synchronous
 * reads, and the attribute is set in a layout effect, before the first paint,
 * so there is no flash of the other theme.
 */
export function useAdminTheme(): {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
} {
  const [preference, setPreferenceState] = useState<ThemePreference>(readThemePreference)
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme)
  const resolved = resolveTheme(preference, system)

  useLayoutEffect(() => {
    const query = darkQuery()
    if (query === null) return
    const onChange = (event: MediaQueryListEvent) => setSystem(event.matches ? 'dark' : 'light')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.adminTheme = resolved
    return () => {
      delete root.dataset.adminTheme
    }
  }, [resolved])

  const setPreference = useCallback((next: ThemePreference) => {
    writeThemePreference(next)
    setPreferenceState(next)
  }, [])

  return { preference, resolved, setPreference }
}
