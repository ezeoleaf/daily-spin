export function sharedUsername(
  pathname: string,
  basePath: string,
): string | null {
  if (!pathname.startsWith(basePath)) return null
  const segment = pathname.slice(basePath.length).replace(/\/$/, '')
  if (!segment || segment.includes('/')) return null
  try {
    const username = decodeURIComponent(segment)
    if (
      !username.trim() ||
      username.length > 100 ||
      /[/\\?#]/.test(username) ||
      username === '.' ||
      username === '..'
    )
      return null
    return username
  } catch {
    return null
  }
}

export function collectionUrl(
  username: string,
  origin: string,
  basePath: string,
): string {
  return new URL(`${basePath}${encodeURIComponent(username)}`, origin).href
}
