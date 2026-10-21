import { expect, test } from '@playwright/test'

const record = {
    id: 101,
    title: 'My Saved Album',
    artist: 'My Artist',
    year: 1977,
    image: '',
    genres: ['Rock'],
    label: 'My Label',
    format: 'Vinyl, LP',
}
const sharedRelease = {
    basic_information: {
        id: 900,
        title: 'A Shared Album',
        artists: [{ name: 'Shared Artist' }],
        year: 1994,
        formats: [{ name: 'Vinyl' }],
        genres: ['Jazz'],
    },
}

test('a Pages deep link loads automatically without replacing a saved library', async ({
    page,
}, testInfo) => {
    await page.goto('./')
    const saved = JSON.stringify({
        username: 'my-library',
        records: [record],
        syncedAt: '2026-10-21T12:00:00Z',
    })
    await page.evaluate(
        (value) => localStorage.setItem('daily-spin.collection.v1', value),
        saved,
    )
    const fallback = await page.request.get('404.html')
    expect(fallback.status()).toBe(200)
    const html = await fallback.text()
    await page.route('**/shared-fan', (route) =>
        route.fulfill({ status: 404, contentType: 'text/html', body: html }),
    )
    await page.route('https://api.discogs.com/**', (route) =>
        route.fulfill({
            json: { pagination: { pages: 1 }, releases: [sharedRelease] },
        }),
    )

    const response = await page.goto('shared-fan')
    expect(response?.status()).toBe(404)
    await expect(
        page.getByRole('button', { name: '@shared-fan' }),
    ).toBeVisible()
    await expect(page.locator('#record-title')).toHaveText('A Shared Album')
    await expect(page.locator('.demo-banner')).toContainText(
        'SHARED COLLECTION',
    )
    expect(
        await page.evaluate(() =>
            localStorage.getItem('daily-spin.collection.v1'),
        ),
    ).toBe(saved)
    await page.reload()
    await expect(page.locator('#record-title')).toHaveText('A Shared Album')
    await page.screenshot({
        path: `test-results/shared-collection-${testInfo.project.name}.png`,
        fullPage: true,
        animations: 'disabled',
        scale: 'css',
    })
    await page.setViewportSize({ width: 320, height: 800 })
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
    ).toBe(true)
    await page.getByRole('button', { name: 'Back to your shelf' }).click()
    await expect(
        page.getByRole('button', { name: '@my-library' }),
    ).toBeVisible()
    await expect(page.locator('#record-title')).toHaveText('My Saved Album')
    await page.reload()
    await expect(
        page.getByRole('button', { name: '@my-library' }),
    ).toBeVisible()
})

test('private shared collections show an error, never show demo picks, and can retry', async ({
    page,
}) => {
    let available = false
    await page.route('https://api.discogs.com/**', (route) =>
        available
            ? route.fulfill({
                  json: { pagination: { pages: 1 }, releases: [sharedRelease] },
              })
            : route.fulfill({ status: 403, json: {} }),
    )
    await page.goto('private-fan')
    await expect(page.getByRole('alert')).toContainText('private')
    await expect(
        page.getByRole('heading', { name: 'Collection unavailable' }),
    ).toBeVisible()
    await expect(page.locator('#record-title')).not.toBeVisible()
    await expect(
        page.getByRole('button', { name: 'Mark as listened' }),
    ).not.toBeVisible()
    available = true
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.locator('#record-title')).toHaveText('A Shared Album')
    expect(
        await page.evaluate(() =>
            localStorage.getItem('daily-spin.collection.v1'),
        ),
    ).toBeNull()
})

test('Share copies the deployment-aware username URL', async ({
    page,
    context,
    baseURL,
}) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('./')
    await page.evaluate(
        (savedRecord) =>
            localStorage.setItem(
                'daily-spin.collection.v1',
                JSON.stringify({
                    username: 'my-library',
                    records: [savedRecord],
                    syncedAt: '2026-10-21T12:00:00Z',
                }),
            ),
        record,
    )
    await page.reload()
    await page.getByRole('button', { name: 'Share collection' }).click()
    const expected = new URL('my-library', baseURL).href
    await expect(page.getByLabel('Collection link / @my-library')).toHaveValue(
        expected,
    )
    await page.getByRole('button', { name: 'Copy link' }).click()
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        expected,
    )
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
})
