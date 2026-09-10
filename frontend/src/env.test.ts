import { describe, expect, it } from 'vitest'
import { EnvValidationError, parseEnv } from './env'

describe('parseEnv', () => {
  it('defaults the API base to the same-origin /api path', () => {
    expect(parseEnv({}).VITE_API_BASE_URL).toBe('/api')
  })

  it('throws a named error when the API base is not a path', () => {
    expect(() => parseEnv({ VITE_API_BASE_URL: 'https://api.example.com' })).toThrow(
      EnvValidationError,
    )
  })
})
