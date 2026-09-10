import { z } from 'zod'

/** Thrown when required configuration is missing or malformed. */
export class EnvValidationError extends Error {
  override readonly name = 'EnvValidationError'

  constructor(issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join('\n')}`)
  }
}

// Same origin in every environment (spec §7), so the default is a bare path and
// nothing here needs a host. Vite proxies it to Express in development.
const schema = z.object({
  VITE_API_BASE_URL: z.string().startsWith('/').default('/api'),
})

export type Env = z.infer<typeof schema>

export function parseEnv(source: Record<string, unknown> = import.meta.env): Env {
  const result = schema.safeParse(source)
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    )
  }
  return result.data
}

export const env = parseEnv()
