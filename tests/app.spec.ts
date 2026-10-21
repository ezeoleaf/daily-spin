import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const cover =
    'https://is1-ssl.mzstatic.com/image/thumb/Music/7f/9f/d6/mzi.vtnaewef.jpg/600x600bb.jpg'
const release = (id: number, format = 'Vinyl') => ({
    basic_information: {
        id,
        title: `Test Album ${id}`,
        year: 1959,
        artists: [{ name: 'Test Artist' }],
        formats: [{ name: format, descriptions: ['LP', 'Album'] }],
        cover_image: cover,
        genres: ['Jazz'],
        labels: [{ name: 'Test Label' }],
    },
})

async function connectCollection(page: Page) {
    await page.route('https://api.discogs.com/**', (route) => {
        const secondPage =
            new URL(route.request().url()).searchParams.get('page') === '2'
        return route.fulfill({
            json: {
                pagination: { pages: 2 },
                releases: secondPage
                    ? [release(103)]
                    : [release(101), release(102, 'CD')],
            },
        })
    })
    await page.getByRole('button', { name: 'Connect Discogs' }).click()
    await page.getByLabel('Discogs username').fill('vinyl-fan')
    await page
        .getByRole('button', { name: 'Connect collection', exact: true })
        .click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: '@vinyl-fan' })).toBeVisible()
}

test('daily pick is stable, alternates work, and the journal persists and can be edited', async ({
    page,
}) => {
    await page.goto('/')
    const title = await page.locator('#record-title').innerText()
    await page.reload()
    await expect(page.locator('#record-title')).toHaveText(title)
    await page.getByRole('button', { name: 'Another pick' }).click()
    await expect(page.locator('#record-title')).not.toHaveText(title)
    const alternateTitle = await page.locator('#record-title').innerText()
    await page.getByRole('button', { name: 'Mark as listened' }).click()
    await expect(
        page.getByRole('button', { name: 'Added to your journal' }),
    ).toBeDisabled()
    await page.reload()
    await page.getByRole('button', { name: 'Listening journal' }).click()
    await expect(
        page.getByRole('heading', { name: alternateTitle, exact: true }),
    ).toBeVisible()
    await page
        .getByRole('button', { name: `Remove ${alternateTitle} from journal` })
        .click()
    await expect(page.getByText('No listens logged yet.')).toBeVisible()
})

test('collection search, genres, empty states, and sorting work', async ({
    page,
}) => {
    await page.goto('/')
    await page.getByRole('button', { name: /^Collection/ }).click()
    await expect(page.locator('.collection-record')).toHaveCount(6)
    await page.getByLabel('Search collection').fill('radiohead')
    await expect(page.locator('.collection-record')).toHaveCount(1)
    await page.getByRole('button', { name: 'Clear search' }).click()
    await page.getByLabel('Filter by genre').selectOption('Jazz')
    await expect(page.locator('.collection-record')).toHaveCount(2)
    await page.getByLabel('Sort collection').selectOption('year')
    await expect(page.locator('.collection-record h3').first()).toHaveText(
        'Pastel Blues',
    )
    await page.getByLabel('Search collection').fill('not a record')
    await expect(
        page.getByRole('heading', { name: 'No records found' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.locator('.collection-record')).toHaveCount(6)
})

test('imports all pages, filters CDs, caches the collection, and separates the demo journal', async ({
    page,
}) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Mark as listened' }).click()
    await connectCollection(page)
    await expect(page.locator('.demo-banner')).not.toBeVisible()
    await page.getByRole('button', { name: /^Collection/ }).click()
    await expect(page.locator('.collection-record')).toHaveCount(2)
    await page.reload()
    await expect(page.getByRole('button', { name: '@vinyl-fan' })).toBeVisible()
    await page.getByRole('button', { name: 'Listening journal' }).click()
    await expect(page.getByText('No listens logged yet.')).toBeVisible()
    await page.getByRole('button', { name: /^Collection/ }).click()
    await page.getByRole('button', { name: 'Disconnect collection' }).click()
    await expect(page.locator('.demo-banner')).toBeVisible()
    await page.getByRole('button', { name: 'Listening journal' }).click()
    await expect(page.locator('.journal-entry')).toHaveCount(1)
})

test('failed sync leaves the saved collection intact', async ({ page }) => {
    await page.goto('/')
    await connectCollection(page)
    await page.route('https://api.discogs.com/**', (route) =>
        route.fulfill({ status: 403, json: { message: 'Forbidden' } }),
    )
    await page.getByRole('button', { name: /^Collection/ }).click()
    await page.getByRole('button', { name: 'Sync collection' }).click()
    await expect(page.getByRole('alert')).toContainText('private')
    await expect(page.locator('.collection-record')).toHaveCount(2)
    await page.reload()
    await expect(page.getByRole('button', { name: '@vinyl-fan' })).toBeVisible()
})

test('connection dialog explains a missing account and supports Escape', async ({
    page,
}) => {
    await page.route('https://api.discogs.com/**', (route) =>
        route.fulfill({ status: 404, json: {} }),
    )
    await page.goto('/')
    await page.getByRole('button', { name: 'Connect Discogs' }).click()
    await page.getByLabel('Discogs username').fill('missing-user')
    await page
        .getByRole('button', { name: 'Connect collection', exact: true })
        .click()
    await expect(page.getByRole('alert')).toContainText('not found')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
})

test('corrupted cache falls back safely and blocked storage is reported', async ({
    page,
}) => {
    await page.addInitScript(() => {
        localStorage.setItem('daily-spin.collection.v1', '{broken')
        localStorage.setItem('daily-spin.journals.v1', '{"demo":[null]}')
        Storage.prototype.setItem = () => {
            throw new Error('Storage blocked')
        }
    })
    await page.goto('/')
    await expect(page.locator('#record-title')).not.toBeEmpty()
    await page.getByRole('button', { name: 'Mark as listened' }).click()
    await expect(page.getByRole('alert')).toContainText('storage is unavailable')
    await page.getByRole('button', { name: 'Listening journal' }).click()
    await expect(page.locator('.journal-entry')).toHaveCount(1)
})

test('daily pick rolls over at local midnight', async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 21, 23, 59, 55) })
    await page.goto('/')
    const before = await page.locator('#record-title').innerText()
    await page.clock.fastForward(20000)
    await expect(page.locator('#record-title')).not.toHaveText(before)
})

test('album artwork renders and primary views fit the viewport', async ({
    page,
}, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/')
    await expect(page.locator('.featured-cover img')).toBeVisible()
    await expect
        .poll(() =>
            page
                .locator('.featured-cover img')
                .evaluate((image) => (image as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({
        path: `test-results/daily-spin-${testInfo.project.name}.png`,
        fullPage: true,
        animations: 'disabled',
        scale: 'css',
    })
    for (const tab of ['Daily pick', 'Collection', 'Listening journal']) {
        await page.getByRole('button', { name: new RegExp(`^${tab}`) }).click()
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true)
    }
    expect(errors).toEqual([])
})

test('Daily Spin preserves legacy saved data and disconnect stays disconnected', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
        const record = {
            id: 101, title: 'Saved Album', artist: 'Saved Artist', year: 1959,
            image: '', genres: ['Jazz'], label: 'Saved Label', format: 'Vinyl, LP',
        }
        localStorage.setItem('daily-record.collection.v1', JSON.stringify({
            username: 'saved-fan', records: [record], syncedAt: '2026-10-21T12:00:00Z',
        }))
        localStorage.setItem('daily-record.journals.v1', JSON.stringify({
            'user:saved-fan': [{ date: '2026-10-21', record }],
        }))
    })
    await page.reload()
    await expect(page).toHaveTitle('Daily Spin - Your Daily Vinyl')
    await expect(page.getByRole('link', { name: 'Daily Spin home' })).toBeVisible()
    await expect(page.getByRole('button', { name: '@saved-fan' })).toBeVisible()
    await expect(page.locator('#record-title')).toHaveText('Saved Album')
    await page.getByRole('button', { name: 'Listening journal' }).click()
    await expect(page.getByRole('heading', { name: 'Saved Album' })).toBeVisible()
    expect(await page.evaluate(() => [
        localStorage.getItem('daily-record.collection.v1'),
        localStorage.getItem('daily-record.journals.v1'),
    ])).toEqual([null, null])
    await page.evaluate(() => {
        const stale = JSON.parse(localStorage.getItem('daily-spin.collection.v1')!)
        stale.username = 'outdated-fan'
        localStorage.setItem('daily-record.collection.v1', JSON.stringify(stale))
    })
    await page.reload()
    await expect(page.getByRole('button', { name: '@saved-fan' })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('daily-record.collection.v1'))).toBeNull()
    await page.getByRole('button', { name: /^Collection/ }).click()
    await page.getByRole('button', { name: 'Disconnect collection' }).click()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Connect Discogs' })).toBeVisible()
})
