import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Disc3,
  ExternalLink,
  Headphones,
  Library,
  Link2,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Search,
  Share2,
  Shuffle,
  Trash2,
  X,
} from 'lucide-react'
import { demoRecords } from './demo'
import { collectionUrl, sharedUsername as usernameFromPath } from './sharing'
import { dailyRecord, fetchCollection, localDate } from './records'
import type { Collection, Listen, RecordAlbum } from './records'

type Tab = 'today' | 'collection' | 'journal'
type Journals = Record<string, Listen[]>
const CACHE_KEY = 'daily-spin.collection.v1'
const JOURNAL_KEY = 'daily-spin.journals.v1'

function readStored<Value>(
  key: string,
  fallback: Value,
  legacyKey: string,
): Value {
  try {
    const current = localStorage.getItem(key)
    const legacy = localStorage.getItem(legacyKey)
    const value = JSON.parse(current ?? legacy ?? 'null') ?? fallback
    if (legacy !== null) {
      try {
        if (current === null) localStorage.setItem(key, legacy)
        localStorage.removeItem(legacyKey)
      } catch {}
    }
    return value
  } catch {
    return fallback
  }
}

function validRecord(record: RecordAlbum): boolean {
  return (
    record != null &&
    typeof record.id === 'number' &&
    typeof record.artist === 'string' &&
    typeof record.title === 'string' &&
    typeof record.image === 'string' &&
    typeof record.year === 'number' &&
    typeof record.label === 'string' &&
    typeof record.format === 'string' &&
    Array.isArray(record.genres) &&
    record.genres.every((genre) => typeof genre === 'string')
  )
}

function initialCollection(): Collection | null {
  const saved = readStored<Collection | null>(
    CACHE_KEY,
    null,
    'daily-record.collection.v1',
  )
  return saved &&
    typeof saved.username === 'string' &&
    typeof saved.syncedAt === 'string' &&
    Array.isArray(saved.records) &&
    saved.records.length &&
    saved.records.every(validRecord)
    ? saved
    : null
}

function initialJournals(): Journals {
  const saved = readStored<Journals>(
    JOURNAL_KEY,
    {},
    'daily-record.journals.v1',
  )
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {}
  return Object.fromEntries(
    Object.entries(saved).filter(
      ([, listens]) =>
        Array.isArray(listens) &&
        listens.every(
          (listen) =>
            listen &&
            typeof listen.date === 'string' &&
            validRecord(listen.record),
        ),
    ),
  )
}

function recordLink(record: RecordAlbum): string {
  return record.id > 0
    ? `https://www.discogs.com/release/${record.id}`
    : `https://www.discogs.com/search/?q=${encodeURIComponent(`${record.artist} ${record.title}`)}&type=release&format=Vinyl`
}

function Cover({
  record,
  className = '',
}: {
  record: RecordAlbum
  className?: string
}) {
  const [failedImage, setFailedImage] = useState('')
  return (
    <div className={`cover ${className}`}>
      {record.image && failedImage !== record.image ? (
        <img
          src={record.image}
          alt={`${record.title} album cover`}
          onError={() => setFailedImage(record.image)}
        />
      ) : (
        <div className="cover-fallback">
          <Disc3 size={64} strokeWidth={1} />
          <span>{record.title}</span>
        </div>
      )}
    </div>
  )
}

function ConnectionDialog({
  username,
  loading,
  progress,
  error,
  onConnect,
  onClose,
}: {
  username: string
  loading: boolean
  progress: string
  error: string
  onConnect: (username: string) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [input, setInput] = useState(username)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  function submit(event: FormEvent) {
    event.preventDefault()
    onConnect(input.trim())
  }
  return (
    <dialog ref={dialog} onCancel={onClose} aria-labelledby="connect-title">
      <div className="dialog-top">
        <Disc3 size={28} />
        <button
          className="icon-button"
          title="Close"
          aria-label="Close"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <h2 id="connect-title">
        Your collection.
        <br />
        <em>A new daily ritual.</em>
      </h2>
      <form onSubmit={submit}>
        <label htmlFor="username">Discogs username</label>
        <div className="username-input">
          <span>@</span>
          <input
            id="username"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            autoComplete="username"
            placeholder="Your username"
            required
            maxLength={100}
            disabled={loading}
          />
        </div>
        <p className="field-note">
          Public collections only. No password or API token needed.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button primary full"
          disabled={loading || !input.trim()}
        >
          {loading ? (
            <LoaderCircle size={18} className="spin" />
          ) : (
            <Link2 size={18} />
          )}
          {loading ? progress : 'Connect collection'}
          {!loading && <ArrowRight size={18} />}
        </button>
      </form>
      <a
        className="text-link settings-link"
        href="https://www.discogs.com/settings/privacy"
        target="_blank"
        rel="noreferrer"
      >
        Discogs privacy settings <ArrowUpRight size={14} />
      </a>
    </dialog>
  )
}

function ShareDialog({
  username,
  onClose,
}: {
  username: string
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const url = collectionUrl(
    username,
    window.location.origin,
    import.meta.env.BASE_URL,
  )
  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setCopyError(false)
    } catch {
      setCopyError(true)
    }
  }

  return (
    <dialog ref={dialog} onCancel={onClose} aria-labelledby="share-title">
      <div className="dialog-top">
        <Share2 size={26} />
        <button
          className="icon-button"
          title="Close"
          aria-label="Close"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <h2 id="share-title">Share this shelf.</h2>
      <label htmlFor="share-url">Collection link / @{username}</label>
      <div className="username-input">
        <input
          id="share-url"
          value={url}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>
      {copyError && (
        <p className="error" role="alert">
          Clipboard unavailable.
        </p>
      )}
      <button
        className="button primary full share-copy"
        onClick={() => void copyLink()}
      >
        {copied ? <Check size={18} /> : <Copy size={18} />}
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </dialog>
  )
}

function App() {
  const [routeUsername, setRouteUsername] = useState(() =>
    usernameFromPath(window.location.pathname, import.meta.env.BASE_URL),
  )
  const [collection, setCollection] = useState<Collection | null>(() => {
    const saved = initialCollection()
    return routeUsername &&
      saved?.username.toLowerCase() !== routeUsername.toLowerCase()
      ? null
      : saved
  })
  const [journals, setJournals] = useState<Journals>(initialJournals)
  const [tab, setTab] = useState<Tab>('today')
  const [today, setToday] = useState(localDate)
  const [alternate, setAlternate] = useState({ key: '', index: 0 })
  const [connecting, setConnecting] = useState(false)
  const [loading, setLoading] = useState(Boolean(routeUsername))
  const [sharing, setSharing] = useState(false)
  const [progress, setProgress] = useState('Connecting...')
  const [error, setError] = useState('')
  const [storageError, setStorageError] = useState('')
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('All genres')
  const [sort, setSort] = useState('artist')
  const controller = useRef<AbortController | null>(null)
  const records = collection?.records ?? demoRecords
  const username = collection?.username ?? 'demo'
  const accountKey = collection ? `user:${username.toLowerCase()}` : 'demo'
  const listens = journals[accountKey] ?? []
  const pickKey = `${accountKey}:${today}`
  const alternateIndex = alternate.key === pickKey ? alternate.index : 0
  const pickDate = new Date(`${today}T12:00:00`)
  pickDate.setDate(pickDate.getDate() + alternateIndex)
  const pick = dailyRecord(records, username, localDate(pickDate))!
  const listened = listens.some(
    (listen) => listen.date === today && listen.record.id === pick.id,
  )
  const dateLabel = new Date(`${today}T12:00:00`).toLocaleDateString(
    undefined,
    { weekday: 'long', month: 'long', day: 'numeric' },
  )
  const genres = [...new Set(records.flatMap((record) => record.genres))].sort()
  const filtered = records
    .filter(
      (record) =>
        `${record.artist} ${record.title}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (genre === 'All genres' || record.genres.includes(genre)),
    )
    .sort((first, second) =>
      sort === 'year'
        ? second.year - first.year || first.title.localeCompare(second.title)
        : sort === 'title'
          ? first.title.localeCompare(second.title)
          : first.artist.localeCompare(second.artist),
    )

  useEffect(() => {
    const timer = window.setInterval(() => setToday(localDate()), 15000)
    return () => {
      clearInterval(timer)
      controller.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!routeUsername) return
    const request = new AbortController()
    controller.current = request
    void fetchCollection(routeUsername, setProgress, request.signal)
      .then((imported) => {
        if (!request.signal.aborted) setCollection(imported)
      })
      .catch((failure: unknown) => {
        if (!request.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Could not open this collection.',
          )
      })
      .finally(() => {
        if (!request.signal.aborted) setLoading(false)
      })
    return () => request.abort()
  }, [routeUsername])

  function saveCollection(next: Collection | null, persist = true) {
    setCollection(next)
    if (!persist) return
    try {
      if (next) localStorage.setItem(CACHE_KEY, JSON.stringify(next))
      else localStorage.removeItem(CACHE_KEY)
    } catch {
      setStorageError(
        'Browser storage is unavailable or full. Changes will only last for this visit.',
      )
    }
  }

  function saveJournals(next: Journals) {
    setJournals(next)
    try {
      localStorage.setItem(JOURNAL_KEY, JSON.stringify(next))
    } catch {
      setStorageError(
        'Browser storage is unavailable or full. Changes will only last for this visit.',
      )
    }
  }

  async function connect(input: string, asShared = false) {
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    setLoading(true)
    setError('')
    try {
      const imported = await fetchCollection(input, setProgress, request.signal)
      if (request.signal.aborted) return
      saveCollection(imported, !asShared)
      if (!asShared && routeUsername) {
        setRouteUsername(null)
        window.history.replaceState(null, '', import.meta.env.BASE_URL)
      }
      setConnecting(false)
      setSearch('')
      setGenre('All genres')
    } catch (failure) {
      if (!request.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Something went wrong. Try again.',
        )
    } finally {
      if (controller.current === request) setLoading(false)
    }
  }

  function closeConnection() {
    controller.current?.abort()
    setLoading(false)
    setConnecting(false)
    setError('')
  }

  function disconnectCollection() {
    controller.current?.abort()
    setLoading(false)
    if (routeUsername) {
      setRouteUsername(null)
      window.history.replaceState(null, '', import.meta.env.BASE_URL)
      setCollection(initialCollection())
    } else saveCollection(null)
    setSearch('')
    setGenre('All genres')
    setError('')
  }
  function logListen() {
    if (listened) return
    saveJournals({
      ...journals,
      [accountKey]: [{ date: today, record: pick }, ...listens],
    })
  }
  function removeListen(date: string, id: number) {
    saveJournals({
      ...journals,
      [accountKey]: listens.filter(
        (listen) => listen.date !== date || listen.record.id !== id,
      ),
    })
  }

  return (
    <>
      <div className="app-shell">
        <header className="site-header">
          <a
            href="#"
            className="brand"
            onClick={(event) => {
              event.preventDefault()
              setTab('today')
            }}
            aria-label="Daily Spin home"
          >
            <Disc3 size={34} strokeWidth={1.5} />
            <span>
              daily spin<span className="brand-dot">.</span>
            </span>
          </a>
          <div className="header-actions">
            {collection && (
              <button
                className="icon-button"
                title="Share collection"
                aria-label="Share collection"
                onClick={() => setSharing(true)}
              >
                <Share2 size={18} />
              </button>
            )}
            <button
              className={`button account-button ${collection ? 'connected' : ''}`}
              onClick={() => {
                setError('')
                setConnecting(true)
              }}
            >
              <span className="status-dot" />
              {collection ? `@${username}` : 'Connect Discogs'}
              <ArrowUpRight size={15} />
            </button>
          </div>
        </header>
        <div className="navigation-row">
          <nav aria-label="Main navigation">
            {(
              [
                ['today', Disc3, 'Daily pick'],
                ['collection', Library, 'Collection'],
                ['journal', BookOpen, 'Listening journal'],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                key={value}
                className={tab === value ? 'nav-button active' : 'nav-button'}
                onClick={() => setTab(value)}
                aria-current={tab === value ? 'page' : undefined}
              >
                <Icon size={16} />
                <span>{label}</span>
                {value === 'collection' && (
                  <span className="nav-count">
                    {routeUsername && !collection ? '...' : records.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <span className="date-short">
            {new Date(`${today}T12:00:00`).toLocaleDateString(undefined, {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            })}
          </span>
        </div>
        {!collection && !routeUsername && (
          <div className="demo-banner">
            <span>
              <span className="demo-label">THE DEMO SHELF</span>
              <span className="demo-detail">
                {' '}
                A little taste before your own collection.
              </span>
            </span>
            <button onClick={() => setConnecting(true)}>
              Connect yours <ArrowRight size={15} />
            </button>
          </div>
        )}
        {routeUsername && (
          <div className="demo-banner">
            <span>
              <span className="demo-label">SHARED COLLECTION</span>
              <span className="demo-detail"> @{routeUsername}</span>
            </span>
            <button onClick={disconnectCollection}>
              Back to your shelf <ArrowRight size={15} />
            </button>
          </div>
        )}
        {storageError && (
          <div className="error storage-error" role="alert">
            {storageError}
          </div>
        )}
        {error && !connecting && (
          <div className="error storage-error" role="alert">
            {error}
          </div>
        )}
        <main>
          {routeUsername && !collection ? (
            <section className="empty-state" aria-busy={loading}>
              {loading ? (
                <LoaderCircle size={36} className="spin" />
              ) : (
                <Disc3 size={36} />
              )}
              <h2>
                {loading
                  ? `Opening @${routeUsername}`
                  : 'Collection unavailable'}
              </h2>
              {loading ? (
                <p role="status">{progress}</p>
              ) : (
                <button
                  className="button primary"
                  onClick={() => void connect(routeUsername, true)}
                >
                  <RefreshCw size={16} />
                  Try again
                </button>
              )}
              <button className="text-link" onClick={disconnectCollection}>
                Back to your shelf <ArrowRight size={16} />
              </button>
            </section>
          ) : (
            <>
              {tab === 'today' && (
                <>
                  <section
                    className="daily-section"
                    aria-labelledby="record-title"
                  >
                    <div className="section-kicker">
                      <span>
                        <span className="live-dot" />
                        {alternateIndex
                          ? 'A LITTLE CHANGE OF PACE'
                          : 'TODAY, ON ROTATION'}
                      </span>
                      <span>{dateLabel}</span>
                    </div>
                    <div className="daily-grid">
                      <div className="record-stage">
                        <div className="vinyl-disc" aria-hidden="true">
                          <div className="vinyl-label">
                            <span>
                              DAILY
                              <br />
                              SPIN
                            </span>
                            <i />
                          </div>
                        </div>
                        <Cover record={pick} className="featured-cover" />
                        <div className="sleeve-caption">
                          <span>
                            SELECTED FROM{' '}
                            {collection ? 'YOUR COLLECTION' : 'THE DEMO SHELF'}
                          </span>
                          <span>33 / 45</span>
                        </div>
                      </div>
                      <div className="record-info" key={`${today}:${pick.id}`}>
                        <div className="record-genre">
                          {pick.genres[0] || 'FROM YOUR SHELF'}
                          <span />
                          {pick.year || 'UNDATED'}
                        </div>
                        <h1 id="record-title">{pick.title}</h1>
                        <p className="artist-name">{pick.artist}</p>
                        <div className="record-rule" />
                        <dl className="record-details">
                          <div>
                            <dt>LABEL</dt>
                            <dd>{pick.label}</dd>
                          </div>
                          <div>
                            <dt>PRESSING</dt>
                            <dd>{pick.format}</dd>
                          </div>
                        </dl>
                        <div className="pick-actions">
                          <button
                            className={`button primary ${listened ? 'is-listened' : ''}`}
                            onClick={logListen}
                            disabled={listened}
                          >
                            {listened ? (
                              <CheckCircle2 size={18} />
                            ) : (
                              <Headphones size={18} />
                            )}
                            {listened
                              ? 'Added to your journal'
                              : 'Mark as listened'}
                          </button>
                          <a
                            href={recordLink(pick)}
                            target="_blank"
                            rel="noreferrer"
                            className="icon-button discogs-link"
                            title="View on Discogs"
                            aria-label="View on Discogs"
                          >
                            <ArrowUpRight size={21} />
                          </a>
                        </div>
                        <button
                          className="another-pick"
                          onClick={() =>
                            setAlternate({
                              key: pickKey,
                              index: (alternateIndex + 1) % records.length,
                            })
                          }
                          disabled={records.length < 2}
                        >
                          <Shuffle size={15} />
                          Another pick
                        </button>
                      </div>
                    </div>
                  </section>
                  <section
                    className="shelf-section"
                    aria-labelledby="shelf-title"
                  >
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">GOOD COMPANY</span>
                        <h2 id="shelf-title">
                          Also on your shelf<span className="small-dot">.</span>
                        </h2>
                      </div>
                      <button
                        className="text-link"
                        onClick={() => setTab('collection')}
                      >
                        View collection <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="mini-shelf">
                      {records
                        .filter((record) => record.id !== pick.id)
                        .slice(0, 4)
                        .map((record) => (
                          <a
                            href={recordLink(record)}
                            key={record.id}
                            target="_blank"
                            rel="noreferrer"
                            className="shelf-record"
                          >
                            <Cover record={record} />
                            <div>
                              <h3>{record.title}</h3>
                              <p>{record.artist}</p>
                              <span>
                                {record.year || 'Year unknown'}{' '}
                                <ArrowUpRight size={13} />
                              </span>
                            </div>
                          </a>
                        ))}
                    </div>
                  </section>
                </>
              )}
              {tab === 'collection' && (
                <section className="collection-section">
                  <div className="section-heading page-heading">
                    <div>
                      <span className="eyebrow">
                        {collection ? `@${username}` : 'THE DEMO SHELF'}
                      </span>
                      <h1>
                        Your collection<span className="small-dot">.</span>
                      </h1>
                      <p>
                        {records.length} vinyl releases. Plenty of good days
                        ahead.
                      </p>
                    </div>
                    {collection && (
                      <div className="collection-actions">
                        <button
                          className="button secondary"
                          onClick={() =>
                            void connect(username, Boolean(routeUsername))
                          }
                          disabled={loading}
                        >
                          <RefreshCw
                            size={16}
                            className={loading ? 'spin' : ''}
                          />
                          {loading ? progress : 'Sync collection'}
                        </button>
                        <button
                          className="icon-button"
                          title="Disconnect collection"
                          aria-label="Disconnect collection"
                          onClick={disconnectCollection}
                        >
                          <LogOut size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                  {collection && (
                    <p className="sync-note">
                      Last synced{' '}
                      {new Date(collection.syncedAt).toLocaleString()}
                      {Date.parse(`${today}T00:00:00`) -
                        Date.parse(collection.syncedAt) >
                      86400000
                        ? ' / Sync to check for new additions.'
                        : ''}
                    </p>
                  )}
                  <div className="collection-toolbar">
                    <label className="search-box">
                      <Search size={17} />
                      <input
                        aria-label="Search collection"
                        placeholder="Search artist or album"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                      {search && (
                        <button
                          className="icon-button"
                          aria-label="Clear search"
                          title="Clear search"
                          onClick={() => setSearch('')}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </label>
                    <select
                      aria-label="Filter by genre"
                      value={genre}
                      onChange={(event) => setGenre(event.target.value)}
                    >
                      <option>All genres</option>
                      {genres.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Sort collection"
                      value={sort}
                      onChange={(event) => setSort(event.target.value)}
                    >
                      <option value="artist">Artist A-Z</option>
                      <option value="title">Album A-Z</option>
                      <option value="year">Newest first</option>
                    </select>
                  </div>
                  <p className="results-count">
                    {filtered.length}{' '}
                    {filtered.length === 1 ? 'record' : 'records'}{' '}
                    <ArrowDown size={12} />
                  </p>
                  <div className="collection-grid">
                    {filtered.map((record) => (
                      <a
                        className="collection-record"
                        key={record.id}
                        href={recordLink(record)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Cover record={record} />
                        <div className="collection-record-title">
                          <h3>{record.title}</h3>
                          <ArrowUpRight size={16} />
                        </div>
                        <p>{record.artist}</p>
                        <span>
                          {record.year || 'Year unknown'} /{' '}
                          {record.genres[0] || 'Vinyl'}
                        </span>
                      </a>
                    ))}
                  </div>
                  {!filtered.length && (
                    <div className="empty-state">
                      <Search size={32} />
                      <h2>No records found</h2>
                      <p>Nothing matches this search.</p>
                      <button
                        className="text-link"
                        onClick={() => {
                          setSearch('')
                          setGenre('All genres')
                        }}
                      >
                        Clear filters <X size={14} />
                      </button>
                    </div>
                  )}
                </section>
              )}
              {tab === 'journal' && (
                <section className="journal-section">
                  <div className="section-heading page-heading">
                    <div>
                      <span className="eyebrow">
                        {collection
                          ? 'YOUR LISTENING JOURNAL'
                          : 'DEMO LISTENING JOURNAL'}
                      </span>
                      <h1>
                        Days well played<span className="small-dot">.</span>
                      </h1>
                      <p>
                        {listens.length}{' '}
                        {listens.length === 1 ? 'listen' : 'listens'} /{' '}
                        {
                          new Set(listens.map((listen) => listen.record.id))
                            .size
                        }{' '}
                        records rediscovered
                      </p>
                    </div>
                    <Headphones
                      className="journal-icon"
                      size={42}
                      strokeWidth={1}
                    />
                  </div>
                  {!listens.length ? (
                    <div className="empty-state">
                      <Disc3 size={48} strokeWidth={1} />
                      <h2>The first spin is yours.</h2>
                      <p>No listens logged yet.</p>
                      <button
                        className="button primary"
                        onClick={() => setTab('today')}
                      >
                        Today's record <ArrowRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="journal-list">
                      {listens.map((listen) => (
                        <article
                          className="journal-entry"
                          key={`${listen.date}:${listen.record.id}`}
                        >
                          <time dateTime={listen.date}>
                            {new Date(
                              `${listen.date}T12:00:00`,
                            ).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                            <span>{listen.date.slice(0, 4)}</span>
                          </time>
                          <Cover record={listen.record} />
                          <div className="journal-record">
                            <h3>{listen.record.title}</h3>
                            <p>{listen.record.artist}</p>
                          </div>
                          <span className="listened-tag">
                            <Check size={13} />
                            Listened
                          </span>
                          <button
                            className="icon-button"
                            title="Remove listen"
                            aria-label={`Remove ${listen.record.title} from journal`}
                            onClick={() =>
                              removeListen(listen.date, listen.record.id)
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </main>
        <footer>
          <span className="footer-brand">
            <Disc3 size={17} /> One record. Every day.
          </span>
          <a href="https://www.discogs.com" target="_blank" rel="noreferrer">
            {collection
              ? 'Collection data by Discogs'
              : 'Connect your collection with Discogs'}
            <ExternalLink size={12} />
          </a>
          <span className="footer-note">
            {collection
              ? 'A little less scrolling. A little more listening.'
              : 'Demo artwork via Apple Music'}
          </span>
        </footer>
      </div>
      {sharing && collection && (
        <ShareDialog username={username} onClose={() => setSharing(false)} />
      )}
      {connecting && (
        <ConnectionDialog
          username={collection?.username ?? ''}
          loading={loading}
          progress={progress}
          error={error}
          onConnect={(input) => void connect(input)}
          onClose={closeConnection}
        />
      )}
    </>
  )
}

export default App
