/**
 * FindTutor.tsx
 *
 * "Find a Tutor" — replaces the old plain list-only Book.tsx page (still
 * reachable at /book, which now redirects here — see App.tsx). Same booking
 * mechanism as before (Calendly popup), plus:
 *   - An embedded Google Map (Maps JavaScript API) centered on the studio's
 *     real, public home address.
 *   - A location search (Places Autocomplete) + a "use my location" button
 *     (plain browser Geolocation — works even without a Maps API key, since
 *     it needs no Google dependency at all).
 *   - Tutor markers; clicking one opens an info window with that tutor's
 *     bio/subjects/reviews.
 *
 * ── DATA HONESTY — read before changing anything below ──────────────────────
 * Tutor accounts already exist in Firestore (`users` docs with `role ==
 * 'tutor'`), fetched the exact same way the old Book.tsx always did. But:
 *   1. TutorDashboard.tsx now has a "Your Location" card (address input ->
 *      Google Geocoding API -> `location: {lat,lng}` + `locationAddress` on
 *      this tutor's own `users/{uid}` doc, see handleSaveLocation there). As
 *      of this writing no real tutor has used it yet, so every tutor without
 *      an explicit `location` is still plotted at the studio's own address
 *      (STUDIO_LOCATION) as a clearly-labeled default, NOT a claim about
 *      where that person lives — see `hasRealLocation` below. This activates
 *      automatically, no code change needed here, the moment any tutor doc
 *      sets a real `location: {lat,lng}`.
 *   2. There is no public review write-path yet. This page shows consented,
 *      first-party testimonials for Akshat and reads an optional `reviews`
 *      array from Firestore for future tutors. It does not synthesize names,
 *      quotes, recordings, or ratings.
 *   3. The public roster below contains the current MindCraft tutor team.
 *      More tutors appear when they onboard with their own address, intro,
 *      subjects, and real reviews.
 *   4. Tutoring today is virtual (Calendly + Google Meet, see
 *      TutorDashboard.tsx) — nobody meets a tutor in person at the studio
 *      address. The map/copy below says so explicitly so "find tutors near
 *      you" doesn't imply an in-person visit that isn't actually offered.
 */

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import {
  GoogleMap,
  MarkerF,
  InfoWindowF,
  Autocomplete,
  useLoadScript,
  type Libraries,
} from '@react-google-maps/api'
import { MessageSquareQuote, PlayCircle, X } from 'lucide-react'
import {
  formatDistanceMiles,
  filterTutorsForSearch,
  type LatLng,
} from '../lib/geo'
import { MARKETING_BASE } from '../lib/siteUrls'
import s from './FindTutor.module.css'

// ── Studio home base ─────────────────────────────────────────────────────────
// 1600 Grand Ave, St Paul, MN 55105. Macalester College's public address,
// confirmed OK to publish (this is intentional, not an accidental leak).
export const STUDIO_ADDRESS = '1600 Grand Ave, St Paul, MN 55105'
export const STUDIO_LOCATION: LatLng = { lat: 44.9379, lng: -93.1706 }

/** Everett St area, El Cerrito, CA. General neighborhood pin, not a street number. */
export const EL_CERRITO_EVERETT: LatLng = { lat: 37.9234, lng: -122.3106 }

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || ''
const MAP_LIBRARIES: Libraries = ['places']

interface TutorReview {
  studentName: string
  reviewerLabel?: string
  quote: string
  transcript?: string
  mediaUrl?: string
  mediaTitle?: string
  rating?: number
}

interface Tutor {
  id: string
  displayName: string
  bio: string
  subjects: string[]
  calendlyUrl: string
  sessionsCompleted: number
  avatarColor: string
  photoUrl?: string | null
  available: boolean
  location: LatLng
  /** US state code used for regional search filtering (MN, CA, …). */
  state: string
  regionLabel: string
  hasRealLocation: boolean
  reviews: TutorReview[]
}

const DEFAULT_TUTOR_BIO = 'Patient ACT, algebra, precalc, calculus, and stats help for students who need the first step to finally make sense.'

const AKSHAT_REVIEWS: TutorReview[] = [
  {
    studentName: 'Sebastian',
    reviewerLabel: 'MindCraft student',
    quote: 'My tutor inspired me to be a better person as well as a student. He came down to my level and explained things in ways I would understand.',
    transcript: 'My tutor inspired me to be a better person as well as a student. He came down to my level and explained things in ways I would understand.',
    mediaUrl: `${MARKETING_BASE}/img/testimonials/sebastian-feedback.mp4`,
    mediaTitle: 'Sebastian student feedback',
  },
  {
    studentName: 'Mary',
    reviewerLabel: "Ida's parent",
    quote: 'She felt really comfortable and in fact told us that she learned some new approaches to working through her IB math problems, which was just so valuable.',
    transcript: 'Hello, my name is Mary and Akshat tutored my daughter this spring. She was preparing for her IB math exam and he was wonderful. She felt really comfortable and in fact told us that she learned some new approaches to working through her IB math problems, which was just so valuable. He was super reliable, super responsive, and I highly recommend him.',
    mediaUrl: `${MARKETING_BASE}/img/testimonials/mary-ida-feedback.mp4`,
    mediaTitle: 'Mary parent feedback about Ida',
  },
]

// Public demo roster. Regional pins: MN (Akshat) and Bay Area CA (Abhigya).
// Sessions stay virtual; the map routes parents to tutors available in-state.
const DEMO_TUTORS: Tutor[] = [
  {
    id: 'akshat-koirala',
    displayName: 'Akshat Koirala',
    bio: DEFAULT_TUTOR_BIO,
    subjects: ['ACT Math', 'AP Calculus', 'Pre-Calc', 'Statistics'],
    calendlyUrl: 'https://calendly.com/joinmindcraft/30min',
    sessionsCompleted: 0,
    avatarColor: 'linear-gradient(135deg, #2D5016, #58CC02)',
    available: true,
    location: STUDIO_LOCATION,
    state: 'MN',
    regionLabel: 'Macalester · St Paul, MN',
    hasRealLocation: true,
    reviews: AKSHAT_REVIEWS,
  },
  {
    id: 'blake-kell',
    displayName: 'Blake Kell',
    bio: 'Macalester student building MindCraft. Data science and math. Currently in Myrtle Beach. Calm focus for students who need less noise.',
    subjects: ['ACT Math', 'Algebra', 'Statistics'],
    calendlyUrl: 'https://calendly.com/joinmindcraft/30min',
    sessionsCompleted: 0,
    avatarColor: 'linear-gradient(135deg, #143a2e, #5fb779)',
    available: true,
    location: { lat: 33.6891, lng: -78.8867 },
    state: 'SC',
    regionLabel: 'Myrtle Beach, SC',
    hasRealLocation: true,
    reviews: [],
  },
  {
    id: 'abhigya-koirala',
    displayName: 'Abhigya Koirala',
    bio: 'Incoming applied mathematics PhD student at UNC Chapel Hill. Clear routes through hard ideas, without watering them down.',
    subjects: ['Algebra', 'Pre-Calc', 'Calculus', 'Proofs', 'ACT Math'],
    calendlyUrl: 'https://calendly.com/joinmindcraft/30min',
    sessionsCompleted: 0,
    avatarColor: 'linear-gradient(135deg, #143a2e, #247a4d)',
    available: true,
    location: { lat: 35.9049, lng: -79.0469 },
    state: 'NC',
    regionLabel: 'UNC Chapel Hill, NC',
    hasRealLocation: true,
    reviews: [],
  },
]

function loadCalendly(url: string) {
  if (!document.getElementById('calendly-css')) {
    const link = document.createElement('link')
    link.id = 'calendly-css'
    link.rel = 'stylesheet'
    link.href = 'https://assets.calendly.com/assets/external/widget.css'
    document.head.appendChild(link)
  }
  if ((window as any).Calendly) {
    ;(window as any).Calendly.initPopupWidget({ url })
  } else {
    const script = document.createElement('script')
    script.src = 'https://assets.calendly.com/assets/external/widget.js'
    script.onload = () => (window as any).Calendly.initPopupWidget({ url })
    document.head.appendChild(script)
  }
}

// ── Map panel — isolated in its own component so useLoadScript (and any
// Google script injection) only ever runs when an API key actually exists.
// When VITE_GOOGLE_MAPS_API_KEY is unset this component is never mounted. ──
interface TutorMapProps {
  tutors: (Tutor & { distanceKm: number })[]
  origin: LatLng | null
  selectedId: string | null
  onSelect: (id: string | null) => void
  onSearchResult: (loc: LatLng, label: string) => void
}

function TutorMap({ tutors, origin, selectedId, onSelect, onSearchResult }: TutorMapProps) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
  })
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)
  const [searchText, setSearchText] = useState('')
  const [searchError, setSearchError] = useState('')
  const mapRef = useRef<google.maps.Map | null>(null)

  const applyResult = useCallback((loc: LatLng, label: string) => {
    setSearchError('')
    setSearchText(label)
    onSearchResult(loc, label)
    const map = mapRef.current
    if (!map) return
    // Zoom to the search point + nearest tutor pin only (tight, useful framing).
    const visible = filterTutorsForSearch(tutors, loc, label)
    const nearest = visible[0]
    const bounds = new google.maps.LatLngBounds()
    bounds.extend(loc)
    if (nearest) bounds.extend(nearest.location)
    map.fitBounds(bounds, 72)
    google.maps.event.addListenerOnce(map, 'idle', () => {
      const z = map.getZoom()
      if (typeof z === 'number' && z > 12) map.setZoom(12)
      if (typeof z === 'number' && z < 8) map.setZoom(9)
    })
  }, [onSearchResult, tutors])

  const onPlaceChanged = useCallback(() => {
    if (!autocomplete) return
    const place = autocomplete.getPlace()
    const loc = place.geometry?.location
    if (!loc) return
    applyResult(
      { lat: loc.lat(), lng: loc.lng() },
      place.formatted_address || place.name || 'Searched location',
    )
  }, [autocomplete, applyResult])

  /** Among candidate places, pick the one closest to any tutor pin (handles ambiguous streets). */
  const pickBestNearTutors = useCallback((candidates: { loc: LatLng; label: string }[]) => {
    if (!candidates.length) return null
    let best = candidates[0]
    let bestDist = Infinity
    for (const c of candidates) {
      for (const t of tutors) {
        const d = (c.loc.lat - t.location.lat) ** 2 + (c.loc.lng - t.location.lng) ** 2
        if (d < bestDist) {
          bestDist = d
          best = c
        }
      }
    }
    return best
  }, [tutors])

  const runTextSearch = useCallback((raw: string) => {
    const query = raw.trim()
    if (!query) {
      setSearchError('Type an address, city, or ZIP.')
      return
    }
    setSearchError('')
    const map = mapRef.current
    const geocoder = new google.maps.Geocoder()
    const lower = query.toLowerCase()
    const hasHint = /\b(ca|california|mn|minnesota|ny|tx|wa|or)\b/.test(lower) || /\b\d{5}\b/.test(lower)
    const variants = hasHint
      ? [query]
      : [
          query,
          `${query}, El Cerrito, CA`,
          `${query}, California`,
          `${query}, St Paul, MN`,
          `${query}, Minnesota`,
        ]

    const finish = (candidates: { loc: LatLng; label: string }[]) => {
      const best = pickBestNearTutors(candidates)
      if (!best) {
        setSearchError('Could not find that address. Try adding a city or ZIP.')
        return
      }
      applyResult(best.loc, best.label)
    }

    const fromGeocode: { loc: LatLng; label: string }[] = []
    let pending = variants.length
    const maybeDone = () => {
      pending -= 1
      if (pending <= 0) finish(fromGeocode)
    }

    const collectPlaces = (results: google.maps.places.PlaceResult[] | null) => {
      const out: { loc: LatLng; label: string }[] = []
      for (const r of results ?? []) {
        const loc = r.geometry?.location
        if (!loc) continue
        out.push({
          loc: { lat: loc.lat(), lng: loc.lng() },
          label: r.formatted_address || r.name || query,
        })
      }
      return out
    }

    if (map && google.maps.places) {
      const service = new google.maps.places.PlacesService(map)
      service.textSearch({ query }, (results, status) => {
        const placeHits = status === google.maps.places.PlacesServiceStatus.OK
          ? collectPlaces(results)
          : []
        if (placeHits.length) {
          finish(placeHits)
          return
        }
        variants.forEach(attempt => {
          geocoder.geocode(
            { address: attempt, region: 'us', componentRestrictions: { country: 'US' } },
            (geoResults, geoStatus) => {
              if (geoStatus === 'OK' && geoResults?.[0]?.geometry?.location) {
                const loc = geoResults[0].geometry.location
                fromGeocode.push({
                  loc: { lat: loc.lat(), lng: loc.lng() },
                  label: geoResults[0].formatted_address || attempt,
                })
              }
              maybeDone()
            },
          )
        })
      })
      return
    }

    variants.forEach(attempt => {
      geocoder.geocode(
        { address: attempt, region: 'us', componentRestrictions: { country: 'US' } },
        (geoResults, geoStatus) => {
          if (geoStatus === 'OK' && geoResults?.[0]?.geometry?.location) {
            const loc = geoResults[0].geometry.location
            fromGeocode.push({
              loc: { lat: loc.lat(), lng: loc.lng() },
              label: geoResults[0].formatted_address || attempt,
            })
          }
          maybeDone()
        },
      )
    })
  }, [applyResult, pickBestNearTutors])

  // onPlaceChanged references runTextSearch before it's defined in the dep
  // array above; keep a stable submit handler instead.
  const onSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const place = autocomplete?.getPlace()
    const loc = place?.geometry?.location
    if (loc && place) {
      applyResult(
        { lat: loc.lat(), lng: loc.lng() },
        place.formatted_address || place.name || searchText,
      )
      return
    }
    runTextSearch(searchText)
  }, [autocomplete, applyResult, runTextSearch, searchText])

  if (loadError) {
    return (
      <div className={s.mapPlaceholder}>
        <p><strong>Map failed to load.</strong></p>
        <p>Check that the Maps JavaScript API + Places API are enabled and billing is set up for this key in Google Cloud Console.</p>
      </div>
    )
  }

  if (!isLoaded) {
    return <div className={s.mapPlaceholder}><p>Loading map…</p></div>
  }

  const center = origin ?? tutors[0]?.location ?? STUDIO_LOCATION
  const selectedTutor = tutors.find(t => t.id === selectedId) ?? null

  return (
    <div className={s.mapCol}>
      <form className={s.searchRow} onSubmit={onSearchSubmit}>
        <Autocomplete onLoad={setAutocomplete} onPlaceChanged={onPlaceChanged}>
          <input
            className={s.searchInput}
            type="text"
            placeholder="Search a city, zip code, or address…"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
        </Autocomplete>
        <button type="submit" className={s.searchBtn}>Search</button>
        {searchError && <p className={s.searchError}>{searchError}</p>}
      </form>
      <GoogleMap
        mapContainerClassName={s.mapCanvas}
        center={center}
        zoom={origin ? 13 : 12}
        onLoad={map => { mapRef.current = map }}
        options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
      >
        {origin && (
          <MarkerF
            position={origin}
            title="Your searched location"
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#1d3a8a',
              fillOpacity: 1,
              strokeColor: '#fffdf7',
              strokeWeight: 2,
            }}
          />
        )}
        {tutors.map(t => (
          <MarkerF
            key={t.id}
            position={t.location}
            title={`${t.displayName} (${t.regionLabel})`}
            onClick={() => onSelect(t.id)}
          />
        ))}
        {selectedTutor && (
          <InfoWindowF position={selectedTutor.location} onCloseClick={() => onSelect(null)}>
            <div className={s.infoWindow}>
              <strong>{selectedTutor.displayName}</strong>
              <p>{selectedTutor.bio}</p>
              <p className={s.infoNote}>{selectedTutor.regionLabel}. Sessions online over Meet.</p>
              <p className={s.infoNote}>
                {selectedTutor.reviews.length > 0
                  ? `${selectedTutor.reviews.length} review${selectedTutor.reviews.length === 1 ? '' : 's'}`
                  : 'No reviews yet'}
              </p>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
    </div>
  )
}

function MapPlaceholder() {
  return (
    <div className={s.mapCol}>
      <div className={s.mapPlaceholder}>
        <p className={s.mapPlaceholderKicker}>Map unavailable</p>
        <p><strong>Google Maps API key not configured yet.</strong></p>
        <p>Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>.env.local</code> / <code>.env.production</code> and this map (plus location search) activates automatically — nothing else needs to change.</p>
        <p className={s.mapPlaceholderAddr}>MindCraft home base: {STUDIO_ADDRESS}</p>
      </div>
    </div>
  )
}

function TutorReviewsDialog({ tutor, onClose }: { tutor: Tutor; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [onClose])

  return (
    <div className={s.reviewOverlay} onMouseDown={onClose}>
      <section
        className={s.reviewDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutor-reviews-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className={s.reviewDialogHeader}>
          <div>
            <p className={s.reviewDialogKicker}>Student and parent voices</p>
            <h2 id="tutor-reviews-title">Reviews for {tutor.displayName}</h2>
            <p>Read the transcript or play the original recording.</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={s.reviewClose}
            onClick={onClose}
            aria-label="Close reviews"
            title="Close reviews"
          >
            <X aria-hidden="true" size={22} strokeWidth={2.4} />
          </button>
        </header>

        <div className={s.reviewStories}>
          {tutor.reviews.map((review, index) => (
            <article className={s.reviewStory} key={`${review.studentName}-${index}`}>
              <div className={s.reviewTranscriptCard}>
                <div className={s.reviewPanelLabel}>
                  <MessageSquareQuote aria-hidden="true" size={18} />
                  Transcript
                </div>
                <blockquote>“{review.quote}”</blockquote>
                {review.transcript && review.transcript !== review.quote && (
                  <p className={s.reviewTranscript}>{review.transcript}</p>
                )}
                <cite>
                  {review.studentName}
                  {review.reviewerLabel ? ` · ${review.reviewerLabel}` : ''}
                </cite>
              </div>

              <div className={s.reviewRecordingCard}>
                <div className={s.reviewPanelLabel}>
                  <PlayCircle aria-hidden="true" size={18} />
                  Watch and listen
                </div>
                {review.mediaUrl ? (
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    poster={`${MARKETING_BASE}/img/mindcraft-logo.png`}
                    title={review.mediaTitle || `${review.studentName} testimonial`}
                  >
                    <source src={review.mediaUrl} type="video/mp4" />
                  </video>
                ) : (
                  <p className={s.reviewMediaEmpty}>Recording coming soon.</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export default function FindTutor() {
  const [tutors, setTutors] = useState<Tutor[]>(DEMO_TUTORS)
  const [origin, setOrigin] = useState<LatLng | null>(null)
  const [originLabel, setOriginLabel] = useState('')
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reviewTutorId, setReviewTutorId] = useState<string | null>(null)

  useEffect(() => {
    // Same fetch the old Book.tsx always used. NOTE: firestore.rules requires
    // request.auth != null to read any `users/{id}` doc, including this
    // tutor-role query, so a signed-OUT visitor's query fails silently
    // (caught below) and only the public demo tutor shows. This is a
    // pre-existing constraint, not something new introduced here.
    getDocs(query(collection(db, 'users'), where('role', '==', 'tutor')))
      .then(snap => {
        if (snap.empty) return
        const remoteTutors: Tutor[] = []
        for (const d of snap.docs) {
          const data = d.data() as Record<string, any>
          const displayName = typeof data.displayName === 'string' ? data.displayName.trim() : ''
          // Incomplete / placeholder tutor docs (empty name, no real profile)
          // should not appear in the public list.
          if (!displayName) continue
          const email: string = data.calendlyEmail ?? data.email ?? ''
          const slug = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase()
          const calendlyUrl = data.calendlyUrl || (slug ? `https://calendly.com/${slug}` : '')
          const hasRealLocation =
            data.location && typeof data.location.lat === 'number' && typeof data.location.lng === 'number'
          const location = hasRealLocation ? (data.location as LatLng) : STUDIO_LOCATION
          const state = typeof data.state === 'string' && data.state
            ? String(data.state).toUpperCase()
            : (location.lng < -115 ? 'CA' : 'MN')
          const reviews: TutorReview[] = Array.isArray(data.reviews)
            ? data.reviews
                .filter((r: any) => r && typeof r.quote === 'string' && typeof r.studentName === 'string')
                .map((r: any) => ({
                  studentName: r.studentName.trim(),
                  reviewerLabel: typeof r.reviewerLabel === 'string' ? r.reviewerLabel.trim() : undefined,
                  quote: r.quote.trim(),
                  transcript: typeof r.transcript === 'string' ? r.transcript.trim() : r.quote.trim(),
                  mediaUrl: typeof r.mediaUrl === 'string' ? r.mediaUrl.trim() : undefined,
                  mediaTitle: typeof r.mediaTitle === 'string' ? r.mediaTitle.trim() : undefined,
                  rating: typeof r.rating === 'number' ? r.rating : undefined,
                }))
                .slice(0, 20)
            : []
          remoteTutors.push({
            id: d.id,
            displayName,
            bio: data.bio || DEFAULT_TUTOR_BIO,
            subjects: data.subjects ?? [],
            calendlyUrl,
            sessionsCompleted: data.sessionsCompleted ?? 0,
            avatarColor: data.avatarColor ?? 'linear-gradient(135deg, #2D5016, #58CC02)',
            photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : null,
            available: data.available ?? true,
            location,
            state,
            regionLabel: data.locationAddress || data.regionLabel || (state === 'CA' ? 'California' : 'Minnesota'),
            hasRealLocation,
            reviews,
          })
        }
        // Dedupe on BOTH id and normalized display name: real Firestore tutor
        // docs use the account's actual Firebase UID as their doc id, which
        // never matches the demo entries' literal string ids ('akshat-koirala'
        // etc.) — so a signed-in visitor whose query actually succeeds (see
        // the firestore.rules note above) would see the founders duplicated,
        // once as the hardcoded demo entry and once as their own real
        // account. Name-based matching catches that even though id-based
        // matching alone cannot.
        const normalize = (name: string) => name.trim().toLowerCase()
        const demoIds = new Set(DEMO_TUTORS.map(t => t.id))
        const demoNames = new Set(DEMO_TUTORS.map(t => normalize(t.displayName)))
        setTutors([
          ...DEMO_TUTORS,
          ...remoteTutors.filter(t => !demoIds.has(t.id) && !demoNames.has(normalize(t.displayName))),
        ])
      })
      .catch(() => {})
  }, [])

  const rankedTutors = useMemo(
    () => filterTutorsForSearch(tutors, origin, originLabel),
    [tutors, origin, originLabel],
  )
  const reviewTutor = tutors.find(tutor => tutor.id === reviewTutorId) ?? null
  const closeReviews = useCallback(() => setReviewTutorId(null), [])

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported in this browser')
      return
    }
    setLocating(true)
    setLocError('')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setOriginLabel('your current location')
        setLocating(false)
      },
      () => {
        setLocError('Could not get your location — allow location access and try again')
        setLocating(false)
      },
      { timeout: 8000 },
    )
  }

  const handleSearchResult = useCallback((loc: LatLng, label: string) => {
    setOrigin(loc)
    setOriginLabel(label)
  }, [])

  return (
    <div className={s.page}>

      <nav className={s.nav}>
        <Link to="/" className={s.logo}>Mind<span>Craft</span></Link>
      </nav>

      <div className={s.hero}>
        <div className={s.heroInner}>
          <div className={s.heroPill}>Private tutoring studio</div>
          <h1 className={s.heroH1}>Find your tutor.<br />Book in 60 seconds.</h1>
          <p className={s.heroSub}>
            Search near a city or use your location, browse tutors on the map, then book a free session.
          </p>
        </div>
      </div>

      <div className={s.taglineWrap}>
        <div className={s.taglineCard}>
          <div className={s.taglineTitle}>The right tutor changes everything.</div>
          <div className={s.taglineSub}>
            All sessions are virtual (Google Meet). Search your city: the map shows tutors available in that region.
          </div>
        </div>
      </div>

      <div className={s.section}>
        <div className={s.locateRow}>
          <button type="button" className={s.locateBtn} onClick={useMyLocation} disabled={locating}>
            {locating ? 'Locating…' : '📍 Use my location'}
          </button>
          {origin && (
            <span className={s.locateActive}>
              Sorting by distance to {originLabel || 'your search'}
              <button type="button" className={s.locateClear} onClick={() => { setOrigin(null); setOriginLabel('') }}>
                clear
              </button>
            </span>
          )}
          {locError && <span className={s.locateError}>{locError}</span>}
        </div>

        <div className={s.mapLayout}>
          {GOOGLE_MAPS_API_KEY ? (
            <TutorMap
              tutors={rankedTutors}
              origin={origin}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onSearchResult={handleSearchResult}
            />
          ) : (
            <MapPlaceholder />
          )}

          <div className={s.tutorList}>
            <h2 className={s.sectionTitle}>Tutors near me</h2>
            {rankedTutors.map(tutor => (
              <div
                key={tutor.id}
                className={`${s.tutorListCard} ${selectedId === tutor.id ? s.tutorListCardActive : ''}`}
                role="link"
                tabIndex={0}
                onClick={() => {
                  setSelectedId(tutor.id)
                  if (tutor.available) loadCalendly(tutor.calendlyUrl)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedId(tutor.id)
                    if (tutor.available) loadCalendly(tutor.calendlyUrl)
                  }
                }}
              >
                <div className={s.tutorHeader}>
                  <div className={s.avatar} style={{ background: tutor.avatarColor }}>
                    {tutor.photoUrl
                      ? <img src={tutor.photoUrl} alt="" />
                      : tutor.displayName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <div className={s.tutorHeaderText}>
                    <div className={s.tutorName}>{tutor.displayName}</div>
                    <div className={s.tutorStat}>
                      {tutor.regionLabel}
                      {' · '}
                      {tutor.available
                        ? (tutor.sessionsCompleted > 0 ? `${tutor.sessionsCompleted}+ sessions` : 'Now booking')
                        : 'Unavailable right now'}
                      {origin && <> · {formatDistanceMiles(tutor.distanceKm)}</>}
                    </div>
                  </div>
                </div>
                <p className={s.tutorBio}>{tutor.bio}</p>
                <div className={s.subjects}>
                  {tutor.subjects.map(sub => (
                    <span key={sub} className={s.subjectTag}>{sub}</span>
                  ))}
                </div>
                <div className={s.reviewsRow}>
                  {tutor.reviews.length > 0 ? (
                    <button
                      type="button"
                      className={s.reviewsButton}
                      aria-haspopup="dialog"
                      onClick={event => {
                        event.stopPropagation()
                        setSelectedId(tutor.id)
                        setReviewTutorId(tutor.id)
                      }}
                    >
                      <MessageSquareQuote aria-hidden="true" size={17} />
                      <span>
                        <strong>{tutor.reviews.length} family review{tutor.reviews.length === 1 ? '' : 's'}</strong>
                        <small>Read transcripts and play recordings</small>
                      </span>
                    </button>
                  ) : (
                    <span className={s.reviewsEmpty}>No reviews yet. Be the first to book.</span>
                  )}
                </div>
                <button
                  className={`${s.bookBtn} ${!tutor.available ? s.bookBtnDisabled : ''}`}
                  disabled={!tutor.available}
                  onClick={e => { e.stopPropagation(); if (tutor.available) loadCalendly(tutor.calendlyUrl) }}
                >
                  {tutor.available ? 'Book Free Session' : 'Booking Opens Soon'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={s.section}>
        <h2 className={s.sectionTitle}>Events nearby</h2>
        <div className={s.eventsGrid}>
          <div className={s.eventCard}>
            <div className={s.eventCafe}>Coming soon</div>
            <div className={s.eventTitle}>Study sessions, hosted at real cafes</div>
            <p className={s.eventDesc}>
              Students hosting live, drop-in study sessions at cafes near you, open to anyone nearby who wants to work alongside other people instead of alone. Nothing is scheduled here yet, this section is not showing real events.
            </p>
          </div>
          <div className={s.eventCard}>
            <div className={s.eventCafe}>Want to host one?</div>
            <div className={s.eventTitle}>Tell us where you'd meet up</div>
            <p className={s.eventDesc}>
              <a href="mailto:founders@joinmindcraft.com">Email founders@joinmindcraft.com</a> with your city and a cafe you like, and we will help get the first ones on the map.
            </p>
          </div>
        </div>
      </div>

      {reviewTutor && <TutorReviewsDialog tutor={reviewTutor} onClose={closeReviews} />}

      <div className={s.footer}>
        Already have an account?{' '}
        <Link to="/login">Sign in to your dashboard →</Link>
      </div>

    </div>
  )
}
