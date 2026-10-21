export interface RecordAlbum {
    id: number
    title: string
    artist: string
    year: number
    image: string
    genres: string[]
    label: string
    format: string
}

export interface Collection {
    username: string
    records: RecordAlbum[]
    syncedAt: string
}

export interface Listen {
    date: string
    record: RecordAlbum
}

interface DiscogsRelease {
    basic_information: {
        id: number
        title: string
        year: number
        cover_image?: string
        thumb?: string
        artists: { name: string; join?: string }[]
        genres?: string[]
        styles?: string[]
        labels?: { name: string }[]
        formats: { name: string; descriptions?: string[] }[]
    }
}

export function vinylRecords(releases: DiscogsRelease[]): RecordAlbum[] {
    const records = new Map<number, RecordAlbum>()
    for (const { basic_information: info } of releases) {
        const vinyl = info.formats.find(
            (format) => format.name.toLowerCase() === 'vinyl',
        )
        if (!vinyl) continue
        records.set(info.id, {
            id: info.id,
            title: info.title,
            artist: info.artists
                .map(
                    (artist, index) =>
                        `${artist.name.replace(/ \(\d+\)$/, '')}${index < info.artists.length - 1 ? ` ${artist.join || ','} ` : ''}`,
                )
                .join(''),
            year: info.year,
            image: info.cover_image || info.thumb || '',
            genres: info.genres || info.styles || [],
            label: info.labels?.[0]?.name || 'Independent',
            format: ['Vinyl', ...(vinyl.descriptions || [])].join(', '),
        })
    }
    return [...records.values()].sort((first, second) => first.id - second.id)
}

export function localDate(date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function hash(value: string): number {
    let result = 2166136261
    for (const character of value)
        result = Math.imul(result ^ character.charCodeAt(0), 16777619)
    return result >>> 0
}

export function dailyRecord(
    records: RecordAlbum[],
    username: string,
    date: string,
): RecordAlbum | undefined {
    const ordered = [...records].sort(
        (first, second) =>
            hash(`${username.toLowerCase()}:${first.id}`) -
            hash(`${username.toLowerCase()}:${second.id}`) || first.id - second.id,
    )
    const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000)
    return ordered[((day % ordered.length) + ordered.length) % ordered.length]
}

const pause = (milliseconds: number, signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        const abort = () => {
            clearTimeout(timer)
            reject(new DOMException('Cancelled', 'AbortError'))
        }
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', abort)
            resolve()
        }, milliseconds)
        if (signal?.aborted) abort()
        else signal?.addEventListener('abort', abort, { once: true })
    })

export async function fetchCollection(
    username: string,
    onProgress: (message: string) => void,
    signal?: AbortSignal,
): Promise<Collection> {
    const releases: DiscogsRelease[] = []
    let pages = 1
    for (let page = 1; page <= pages; page++) {
        if (page > 1) await pause(2600, signal)
        onProgress(`Importing page ${page}${page > 1 ? ` of ${pages}` : ''}...`)
        const url = new URL(
            `https://api.discogs.com/users/${encodeURIComponent(username)}/collection/folders/0/releases`,
        )
        url.search = new URLSearchParams({
            per_page: '100',
            page: String(page),
            sort: 'added',
            sort_order: 'asc',
        }).toString()
        let response: Response
        try {
            response = await fetch(url, {
                signal,
                headers: { Accept: 'application/vnd.discogs.v2.plaintext+json' },
            })
        } catch (error) {
            if (signal?.aborted) throw error
            throw new Error(
                'Could not reach Discogs. Check your connection and try again.',
            )
        }
        if (response.status === 401 || response.status === 403)
            throw new Error(
                'This collection is private. Make it public in your Discogs privacy settings, then try again.',
            )
        if (response.status === 404)
            throw new Error(
                'That Discogs username was not found. Check the spelling and try again.',
            )
        if (response.status === 429)
            throw new Error(
                'Discogs is taking a breather. Wait a minute, then try again. Your existing collection is safe.',
            )
        if (!response.ok)
            throw new Error(
                `Discogs is unavailable (${response.status}). Please try again later.`,
            )
        const data = await response.json()
        if (
            !Array.isArray(data.releases) ||
            !Number.isInteger(data.pagination?.pages) ||
            data.pagination.pages < 0
        )
            throw new Error('Discogs returned an unexpected collection response.')
        pages = data.pagination.pages
        releases.push(...data.releases)
    }
    const records = vinylRecords(releases)
    if (!records.length)
        throw new Error(
            'No vinyl found in this collection. Add a vinyl release on Discogs, then sync again.',
        )
    return { username, records, syncedAt: new Date().toISOString() }
}
