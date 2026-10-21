import { describe, expect, it } from 'vitest'
import { collectionUrl, sharedUsername } from './sharing'

describe('shared collection URLs', () => {
  it('reads usernames under repository and root sites', () => {
    expect(sharedUsername('/daily-spin/vinyl-fan', '/daily-spin/')).toBe(
      'vinyl-fan',
    )
    expect(sharedUsername('/daily-spin/susan.salkeld/', '/daily-spin/')).toBe(
      'susan.salkeld',
    )
    expect(sharedUsername('/a%20user', '/')).toBe('a user')
    expect(sharedUsername('/daily-spin/', '/daily-spin/')).toBeNull()
  })

  it.each([
    '/daily-spin/a/b',
    '/other/user',
    '/daily-spin/%ZZ',
    '/daily-spin/a%2Fb',
    '/daily-spin/..',
  ])('ignores invalid routes: %s', (pathname) => {
    expect(sharedUsername(pathname, '/daily-spin/')).toBeNull()
  })

  it('creates encoded share links with the configured deployment base', () => {
    expect(
      collectionUrl('a user', 'https://ezeoleaf.github.io', '/daily-spin/'),
    ).toBe('https://ezeoleaf.github.io/daily-spin/a%20user')
    expect(collectionUrl('vinyl-fan', 'https://example.com', '/')).toBe(
      'https://example.com/vinyl-fan',
    )
  })
})
