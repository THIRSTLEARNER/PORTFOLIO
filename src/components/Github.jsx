import { useCallback, useEffect, useMemo, useState } from 'react'
import RevealGroup from './RevealGroup.jsx'
import StaggerText from './StaggerText.jsx'

const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours
const FAIL_COOLDOWN_MS = 5 * 60 * 1000 // after a failed fetch, don't hammer the API on every mount

// Snapshot baked from the public GitHub API on 2026-11-17 — instant content,
// and a graceful offline/rate-limited fallback when the live API is unreachable.
// Live data replaces it silently once it resolves.
const GH_FALLBACK_PROFILE = {
  login: 'THIRSTLEARNER',
  avatar_url: 'https://avatars.githubusercontent.com/u/196408602?v=4',
  html_url: 'https://github.com/THIRSTLEARNER',
  public_repos: 11,
  followers: 0,
  created_at: '2025-01-25T04:31:29Z',
}
const GH_FALLBACK_REPOS = [
  { id: 1, name: 'photobooth', description: '', html_url: 'https://github.com/THIRSTLEARNER/photobooth', stars: 0, language: 'JavaScript', pushed_at: '2026-11-13T00:00:00Z' },
  { id: 2, name: 'seasion', description: '', html_url: 'https://github.com/THIRSTLEARNER/seasion', stars: 0, language: 'PHP', pushed_at: '2026-10-10T00:00:00Z' },
  { id: 3, name: 'php-studentdirectory', description: '', html_url: 'https://github.com/THIRSTLEARNER/php-studentdirectory', stars: 0, language: 'PHP', pushed_at: '2026-10-03T00:00:00Z' },
  { id: 4, name: 'freelancewebsite', description: '', html_url: 'https://github.com/THIRSTLEARNER/freelancewebsite', stars: 0, language: 'HTML', pushed_at: '2026-09-26T00:00:00Z' },
  { id: 5, name: 'sign-detector', description: 'Sign detector — browser webcam sign recognition driving a generative galaxy', html_url: 'https://github.com/THIRSTLEARNER/sign-detector', stars: 0, language: 'JavaScript', pushed_at: '2026-09-26T00:00:00Z' },
  { id: 6, name: 'bootstrap', description: '', html_url: 'https://github.com/THIRSTLEARNER/bootstrap', stars: 0, language: 'HTML', pushed_at: '2026-09-13T00:00:00Z' },
]

const LANG_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  HTML: '#e34c26',
  CSS: '#563d7c',
  PHP: '#777bb3',
  Python: '#3572a5',
  'C++': '#f34b7d',
  C: '#555555',
  Java: '#b07219',
  Go: '#00add8',
  Rust: '#dea584',
  Shell: '#89e051',
}

function readCache(key) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`gh-${key}`) || 'null')
    if (!parsed || typeof parsed.at !== 'number') return null
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null
    return parsed.data
  } catch {
    return null
  }
}
function writeCache(key, data) {
  try {
    window.localStorage.setItem(`gh-${key}`, JSON.stringify({ at: Date.now(), data }))
  } catch {
    // storage may be unavailable — fine
  }
}
function readFailStamp() {
  try {
    return Number(window.localStorage.getItem('gh-fail:last')) || 0
  } catch {
    return 0
  }
}
function writeFailStamp(stamp) {
  try {
    if (stamp) window.localStorage.setItem('gh-fail:last', String(stamp))
    else window.localStorage.removeItem('gh-fail:last')
  } catch {
    // storage may be unavailable — fine
  }
}

function timeAgo(iso) {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const days = Math.max(0, Math.floor((Date.now() - then) / 86400000))
  if (days === 0) return 'updated today'
  if (days === 1) return 'updated yesterday'
  if (days < 30) return `updated ${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `updated ${months}mo ago`
  return `updated ${Math.floor(months / 12)}y ago`
}

function normalizeRepos(json) {
  return (Array.isArray(json) ? json : [])
    .filter((repo) => !repo.fork && !repo.archived && !repo.private)
    .sort((a, b) => b.stargazers_count - a.stargazers_count || new Date(b.pushed_at) - new Date(a.pushed_at))
    .slice(0, 6)
    .map((repo) => ({
      id: repo.id,
      name: repo.name,
      description: repo.description || '',
      html_url: repo.html_url,
      stars: repo.stargazers_count,
      language: repo.language || '',
      pushed_at: repo.pushed_at,
    }))
}

function topLanguage(repos) {
  const counts = new Map()
  for (const r of repos) {
    if (!r.language) continue
    counts.set(r.language, (counts.get(r.language) || 0) + 1)
  }
  let best = ''
  let bestN = 0
  for (const [lang, n] of counts) {
    if (n > bestN || (n === bestN && lang < best)) {
      best = lang
      bestN = n
    }
  }
  return best
}

export default function Github({ user }) {
  const login = String(user || '').trim()
  const fallback = useMemo(
    () => ({
      profile: { ...GH_FALLBACK_PROFILE },
      repos: GH_FALLBACK_REPOS.map((r) => ({ ...r })),
    }),
    []
  )

  const [state, setState] = useState(() => ({
    status: 'ready',
    source: 'snapshot',
    profile: readCache(`profile:${login}`) || fallback.profile,
    repos: readCache(`repos:${login}`) || fallback.repos,
  }))

  const loadLive = useCallback(() => {
    if (!login) return
    if (Date.now() - readFailStamp() < FAIL_COOLDOWN_MS) return // back off after a failure
    const controller = new AbortController()

    Promise.allSettled([
      fetch(`https://api.github.com/users/${encodeURIComponent(login)}`, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal,
      }).then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status))))),
      fetch(`https://api.github.com/users/${encodeURIComponent(login)}/repos?sort=updated&per_page=12&type=owner`, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal,
      }).then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status))))),
    ]).then(([profileRes, reposRes]) => {
      if (profileRes.status !== 'fulfilled' && reposRes.status !== 'fulfilled') {
        writeFailStamp(Date.now()) // stay on snapshot; back off before retrying
        setState((s) => ({ ...s, source: s.source === 'live' ? s.source : 'snapshot' }))
        return
      }
      writeFailStamp(0)
      const profile = profileRes.status === 'fulfilled' && profileRes.value
        ? {
            login: profileRes.value.login,
            avatar_url: profileRes.value.avatar_url,
            html_url: profileRes.value.html_url,
            public_repos: profileRes.value.public_repos,
            followers: profileRes.value.followers,
            created_at: profileRes.value.created_at,
          }
        : undefined
      const repos = reposRes.status === 'fulfilled' ? normalizeRepos(reposRes.value) : undefined
      if (profile) writeCache(`profile:${login}`, profile)
      if (repos) writeCache(`repos:${login}`, repos)
      setState((s) => ({
        status: 'ready',
        source: 'live',
        profile: profile || s.profile,
        repos: repos || s.repos,
      }))
    })
    return () => controller.abort()
  }, [login])

  useEffect(() => {
    const cleanup = loadLive()
    return cleanup
  }, [loadLive])

  const totalStars = useMemo(() => state.repos.reduce((sum, r) => sum + (r.stars || 0), 0), [state.repos])
  const modeLang = useMemo(() => topLanguage(state.repos), [state.repos])

  if (!login) return null

  return (
    <section className="section" id="github" aria-label="Open source work on GitHub">
      <div className="container">
        <RevealGroup>
          <div data-reveal-item>
            <StaggerText as="h2" text="Live from GitHub" className="section-title" />
          </div>
          <div data-reveal-item>
            <p className="section-lead">
              Public repositories, pulled straight from the GitHub API — a live pulse of what I&apos;m
              shipping.
            </p>
          </div>
        </RevealGroup>

        <RevealGroup className="gh-strip" stagger={0.1}>
          <a className="card gh-profile" href={state.profile.html_url} target="_blank" rel="noreferrer" data-reveal-item>
            <img
              className="gh-avatar"
              src={state.profile.avatar_url}
              alt={`Avatar of ${state.profile.login}`}
              width="44"
              height="44"
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <span className="gh-profile-meta">
              <span className="gh-handle">@{state.profile.login}</span>
              <span className="gh-sub">
                {state.profile.public_repos} public {state.profile.public_repos === 1 ? 'repo' : 'repos'}
                {modeLang ? ` · top: ${modeLang}` : ''}
                {totalStars > 0 ? ` · ${totalStars}★` : ''}
              </span>
            </span>
            <span className="gh-live-dot" aria-hidden="true" title="Live from the GitHub API" />
          </a>
        </RevealGroup>

        <RevealGroup className="gh-grid" stagger={0.1}>
          {state.repos.map((repo) => (
            <a
              key={repo.id}
              className="card gh-repo"
              href={repo.html_url}
              target="_blank"
              rel="noreferrer"
              data-reveal-item
            >
              <span className="gh-repo-top">
                <svg className="gh-icon" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5.4 5.2 2.8 8l2.6 2.8" />
                  <path d="M10.6 5.2 13.2 8l-2.6 2.8" />
                  <path d="M8.95 3.6 7.05 12.4" />
                </svg>
                <span className="gh-name">{repo.name}</span>
                <span className="gh-stars" aria-label={`${repo.stars} stars`}>
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
                    <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.764 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
                  </svg>
                  {repo.stars}
                </span>
              </span>
              <span className="gh-desc">{repo.description || 'No description yet — see the README.'}</span>
              <span className="gh-meta">
                {repo.language ? (
                  <span className="gh-lang">
                    <span
                      className="gh-lang-dot"
                      style={{ background: LANG_COLORS[repo.language] || '#8b949e' }}
                      aria-hidden="true"
                    />
                    {repo.language}
                  </span>
                ) : null}
                <span className="gh-updated">{timeAgo(repo.pushed_at)}</span>
              </span>
            </a>
          ))}
        </RevealGroup>

        <div className="gh-foot">
          <p className="gh-all">
            <a href={`${state.profile.html_url}?tab=repositories`} target="_blank" rel="noreferrer">
              View all repositories on GitHub
              <span aria-hidden="true"> →</span>
            </a>
          </p>
          <button type="button" className="gh-retry" onClick={() => { writeFailStamp(0); loadLive() }}>
            Refresh
          </button>
        </div>
      </div>
    </section>
  )
}
