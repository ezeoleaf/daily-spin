import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    dailyRecord,
    fetchCollection,
    localDate,
    vinylRecords,
} from './records'

const release = (id: number, format = 'Vinyl') => ({
    basic_information: {
        id,
        title: `Record ${id}`,
        year: 1977,
        artists: [{ name: 'Artist (2)' }],
        formats: [{ name: format }],
    },
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

describe('vinyl collection', () => {
    it('keeps vinyl, deduplicates copies, and normalizes artist names', () => {
        const records = vinylRecords([
            release(2),
            release(1, 'CD'),
            release(2),
            release(3),
        ])
        expect(records.map((record) => record.id)).toEqual([2, 3])
        expect(records[0].artist).toBe('Artist')
    })

    it('produces a stable daily pick independent of API ordering or username case', () => {
        const records = vinylRecords([release(1), release(2), release(3)])
        expect(dailyRecord(records, 'User', '2026-10-21')).toEqual(
            dailyRecord([...records].reverse(), 'user', '2026-10-21'),
        )
        expect(
            new Set(
                ['2026-10-21', '2026-10-22', '2026-10-23'].map(
                    (date) => dailyRecord(records, 'user', date)?.id,
                ),
            ).size,
        ).toBe(3)
        expect(dailyRecord([], 'user', '2026-10-21')).toBeUndefined()
        expect(dailyRecord(records.slice(0, 1), 'user', '2026-10-21')?.id).toBe(1)
    })

    it('uses the local calendar date', () => {
        expect(localDate(new Date(2026, 9, 21, 23, 59))).toBe('2026-10-21')
    })

    it('imports all pages and only returns vinyl', async () => {
        vi.useFakeTimers()
        const mockFetch = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        pagination: { pages: 2 },
                        releases: [release(1, 'CD'), release(2)],
                    }),
                ),
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({ pagination: { pages: 2 }, releases: [release(3)] }),
                ),
            )
        vi.stubGlobal('fetch', mockFetch)
        const result = fetchCollection('a user', vi.fn())
        await vi.runAllTimersAsync()
        expect((await result).records.map((record) => record.id)).toEqual([2, 3])
        expect(mockFetch).toHaveBeenCalledTimes(2)
        expect(String(mockFetch.mock.calls[0][0])).toContain('a%20user')
    })

    it.each([
        [403, 'private'],
        [404, 'not found'],
        [429, 'Wait a minute'],
        [500, 'unavailable'],
    ])('explains HTTP %s', async (code, message) => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(new Response('', { status: code as number })),
        )
        await expect(fetchCollection('user', vi.fn())).rejects.toThrow(
            message as string,
        )
    })

    it('rejects empty collections without replacing the existing cache', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(
                    new Response(
                        JSON.stringify({ pagination: { pages: 0 }, releases: [] }),
                    ),
                ),
        )
        await expect(fetchCollection('user', vi.fn())).rejects.toThrow('No vinyl')
    })
})
