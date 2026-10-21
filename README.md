# Daily Spin

A daily vinyl pick from your Discogs collection. A static React + TypeScript app, built with Vite and deployable to GitHub Pages. No backend, API key, or scheduled job required.

## Start Locally

Use Node.js 24 LTS (`nvm use` if you use nvm).

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. The demo shelf works immediately; choose **Connect Discogs** and enter your username to import your own records.

## Connect Discogs

1. In [Discogs privacy settings](https://www.discogs.com/settings/privacy), make your collection public.
2. Enter your Discogs username in the app, not your email or profile URL.
3. The app imports all pages from your collection, keeps only Vinyl formats, and merges duplicate copies of the same release. Different pressings remain distinct.
4. Use **Collection > Sync collection** after adding or removing records on Discogs.

Requests go directly from your browser to `api.discogs.com` using its public collection API and CORS support. Private collections are not supported: secure OAuth requires a backend, and tokens should never be bundled into a public Pages site. This app never changes your Discogs collection.

Large libraries take longer: imports use 100 releases per page and wait 2.6 seconds between pages to respect the unauthenticated rate limit of 25 requests/minute. Shared-IP traffic can still trigger a rate limit; the app reports this without replacing your previous collection. Closing the connection dialog cancels an import.

## Share a Collection

Open `https://ezeoleaf.github.io/daily-spin/USERNAME` to automatically load that Discogs user's public collection, with no connection form. Usernames with special characters are URL-encoded; the **Share collection** icon next to the account button creates and copies the correct link.

Shared links are previews, not authentication. They never change Discogs or overwrite the visitor's saved collection. **Back to your shelf** returns to their saved library (or the demo). Any listens they log remain local to their browser, not the collection owner's journal. Choosing **Connect collection** explicitly saves that collection as their own. Private or missing collections display an error and a retry option.

The build includes a `404.html` fallback so directly opening or refreshing username links works on GitHub Pages. GitHub still returns HTTP 404 for these deep links even though the app renders, so social crawlers may show a generic preview or no preview. User-specific social previews would require a server or edge hosting with route rewrites.

## Daily Picks and Journal

- Your username determines a stable shuffled order. The local calendar date chooses the record, so refreshing does not change the daily pick.
- With an unchanged collection, every record is recommended once per rotation before repeating. Syncing additions or removals can change that order.
- **Another pick** previews another record for this visit without replacing the normal daily recommendation. It can include tomorrow's pick.
- **Mark as listened** adds the record to your journal once per day. You can remove journal entries.
- Collection data and journals are stored in this browser's local storage, separately for each username and the demo. Disconnecting clears the active cached collection, not journals. Clearing site data removes both; there is no cross-device sync.
- The date updates while the app is open. There are no background notifications or automatic daily imports. Cached records remain available when the API is unavailable; artwork and fonts still require a network connection.

## Deploy to GitHub Pages

1. Push this folder as a GitHub repository with a `main` branch. No repository or branch is created automatically.
2. Open **Settings > Pages > Build and deployment**, and set **Source** to **GitHub Actions**.
3. Push to `main`, or run **Test and Deploy to GitHub Pages** from the Actions tab.

The included workflow installs dependencies, lints, runs unit and desktop/mobile browser tests, builds, then deploys `dist` to Pages. Pull requests run checks without deployment. If your default branch is not `main`, update both the workflow branch trigger and deployment condition.

The workflow sets `PAGES_BASE_PATH` from the repository name (for example `/daily-spin/`), or `/` for a `USERNAME.github.io` repository. For a custom domain served at its root, set this environment value to `/` in both workflow steps. Local development and builds default to `/`.

For a manual repository-site build, run `PAGES_BASE_PATH=/daily-spin/ npm run build`. Use the same variable for `npm run preview` or `npm run test:e2e` so the server and tests use the correct base path. Recommendations are calculated in each visitor's browser, so GitHub Actions only needs to run when the app changes. No GitHub secrets are needed.

## Checks

```sh
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser tests use mocked Discogs API responses, including pagination, private collections, failed syncs, and missing usernames. They test storage persistence, journal isolation, search/filter/sort, midnight rollover, real demo artwork loading, and desktop/mobile viewport overflow. Screenshots are written to `test-results/`. A successful mock test does not guarantee a particular user's collection is public or that Discogs is available.

## Data and Artwork

Live collection metadata and artwork are provided by [Discogs](https://www.discogs.com/developers/) and are subject to its [API Terms of Use](https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use). Daily Spin is not affiliated with Discogs. Demo metadata is curated; demo album artwork URLs are from the Apple iTunes Search API. Artwork belongs to its respective rights holders. Fonts are served by Google Fonts. No analytics or tracking SDKs are included.
