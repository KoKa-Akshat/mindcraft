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
 *   2. No review/rating system exists ANYWHERE in this codebase (grepped
 *      firestore.rules, TutorDashboard, Book.tsx — nothing). This component
 *      reads an optional `reviews` array off the tutor doc if one is ever
 *      added, and renders an honest "no reviews yet" empty state otherwise.
 *      It does NOT fabricate star ratings or named reviewers.
 *   3. Akshat Koirala and Abhigya Koirala below are real people (MindCraft's
 *      founders — same bios used on the marketing site's About section),
 *      carried over verbatim from the original Book.tsx DEMO_TUTORS. They
 *      are not fabricated profiles.
 *   4. Tutoring today is virtual (Calendly + Google Meet, see
 *      TutorDashboard.tsx) — nobody meets a tutor in person at the studio
 *      address. The map/copy below says so explicitly so "find tutors near
 *      you" doesn't imply an in-person visit that isn't actually offered.
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
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
import { haversineKm, formatDistanceMiles, type LatLng } from '../lib/geo'
import s from './FindTutor.module.css'

// ── Studio home base ─────────────────────────────────────────────────────────
// 1600 Grand Ave, St Paul, MN 55105 — Macalester College's public address,
// confirmed OK to publish (this is intentional, not an accidental leak).
export const STUDIO_ADDRESS = '1600 Grand Ave, St Paul, MN 55105'
export const STUDIO_LOCATION: LatLng = { lat: 44.9379, lng: -93.1706 }

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || ''
const MAP_LIBRARIES: Libraries = ['places']

interface TutorReview {
  studentName: string
  quote: string
  rating: number
}

interface Tutor {
  id: string
  displayName: string
  bio: string
  subjects: string[]
  calendlyUrl: string
  sessionsCompleted: number
  avatarColor: string
  available: boolean
  location: LatLng
  hasRealLocation: boolean
  reviews: TutorReview[]
}

const DEFAULT_TUTOR_BIO = 'Calm, step-by-step math support for students who want a clearer plan, stronger habits, and less panic before exams.'

// Real people (MindCraft's founders), carried over from the original
// Book.tsx. Not fabricated — see file header.
const DEMO_TUTORS: Tutor[] = [
  {
    id: 'akshat-koirala',
    displayName: 'Akshat Koirala',
    bio: DEFAULT_TUTOR_BIO,
    subjects: ['ACT Math', 'AP Calculus', 'Pre-Calc', 'Statistics'],
    calendlyUrl: 'https://calendly.com/joinmindcraft/30min',
    sessionsCompleted: 40,
    avatarColor: 'linear-gradient(135deg, #2D5016, #58CC02)',
    available: true,
    location: STUDIO_LOCATION,
    hasRealLocation: false,
    reviews: [],
  },
  {
    id: 'abhigya-koirala',
    displayName: 'Abhigya Koirala',
    bio: 'Applied math depth for students who want rigorous, calm support. Booking opens soon.',
    subjects: ['Applied Math', 'Calculus', 'Proofs', 'Advanced Problem Solving'],
    calendlyUrl: '',
    sessionsCompleted: 0,
    avatarColor: 'linear-gradient(135deg, #4b001d, #e4bf6a)',
    available: false,
    location: STUDIO_LOCATION,
    hasRealLocation: false,
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

  const onPlaceChanged = useCallback(() => {
    if (!autocomplete) return
    const place = autocomplete.getPlace()
    const loc = place.geometry?.location
    if (!loc) return
    const label = place.formatted_address || place.name || 'Searched location'
    onSearchResult({ lat: loc.lat(), lng: loc.lng() }, label)
    setSearchText(label)
  }, [autocomplete, onSearchResult])

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

  const center = origin ?? STUDIO_LOCATION
  const studioSelected = selectedId === 'studio'
  const selectedTutor = tutors.find(t => t.id === selectedId) ?? null

  return (
    <div className={s.mapCol}>
      <div className={s.searchRow}>
        <Autocomplete onLoad={setAutocomplete} onPlaceChanged={onPlaceChanged}>
          <input
            className={s.searchInput}
            type="text"
            placeholder="Search a city, zip code, or address…"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
        </Autocomplete>
      </div>
      <GoogleMap
        mapContainerClassName={s.mapCanvas}
        center={center}
        zoom={origin ? 11 : 13}
        options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
      >
        <MarkerF
          position={STUDIO_LOCATION}
          title={`MindCraft home base — ${STUDIO_ADDRESS}`}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#064d36',
            fillOpacity: 1,
            strokeColor: '#fffdf7',
            strokeWeight: 2,
          }}
          onClick={() => onSelect('studio')}
        />
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
            title={t.displayName}
            onClick={() => onSelect(t.id)}
          />
        ))}
        {studioSelected && (
          <InfoWindowF position={STUDIO_LOCATION} onCloseClick={() => onSelect(null)}>
            <div className={s.infoWindow}>
              <strong>MindCraft home base</strong>
              <p>{STUDIO_ADDRESS}</p>
              <p className={s.infoNote}>Sessions are virtual (Google Meet) — this is our studio address, not a required meeting spot.</p>
            </div>
          </InfoWindowF>
        )}
        {selectedTutor && (
          <InfoWindowF position={selectedTutor.location} onCloseClick={() => onSelect(null)}>
            <div className={s.infoWindow}>
              <strong>{selectedTutor.displayName}</strong>
              <p>{selectedTutor.bio}</p>
              {!selectedTutor.hasRealLocation && (
                <p className={s.infoNote}>Home base: MindCraft studio (exact tutor location not set yet)</p>
              )}
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

export default function FindTutor() {
  const [tutors, setTutors] = useState<Tutor[]>(DEMO_TUTORS)
  const [origin, setOrigin] = useState<LatLng | null>(null)
  const [originLabel, setOriginLabel] = useState('')
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    // Same fetch the old Book.tsx always used. NOTE: firestore.rules requires
    // request.auth != null to read any `users/{id}` doc, including this
    // tutor-role query — so a signed-OUT visitor's query fails silently
    // (caught below) and only the two demo/founder tutors show. This is a
    // pre-existing constraint, not something new introduced here.
    getDocs(query(collection(db, 'users'), where('role', '==', 'tutor')))
      .then(snap => {
        if (snap.empty) return
        const remoteTutors: Tutor[] = snap.docs.map(d => {
          const data = d.data() as Record<string, any>
          const email: string = data.calendlyEmail ?? data.email ?? ''
          const slug = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase()
          const calendlyUrl = data.calendlyUrl || (slug ? `https://calendly.com/${slug}` : '')
          const hasRealLocation =
            data.location && typeof data.location.lat === 'number' && typeof data.location.lng === 'number'
          const reviews: TutorReview[] = Array.isArray(data.reviews)
            ? data.reviews
                .filter((r: any) => r && typeof r.quote === 'string' && typeof r.studentName === 'string')
                .slice(0, 20)
            : []
          return {
            id: d.id,
            displayName: data.displayName ?? 'Tutor',
            bio: data.bio || DEFAULT_TUTOR_BIO,
            subjects: data.subjects ?? [],
            calendlyUrl,
            sessionsCompleted: data.sessionsCompleted ?? 0,
            avatarColor: data.avatarColor ?? 'linear-gradient(135deg, #2D5016, #58CC02)',
            available: data.available ?? true,
            location: hasRealLocation ? (data.location as LatLng) : STUDIO_LOCATION,
            hasRealLocation,
            reviews,
          }
        })
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

  const rankedTutors = useMemo(() => {
    const base = origin ?? STUDIO_LOCATION
    return tutors
      .map(t => ({ ...t, distanceKm: haversineKm(base, t.location) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [tutors, origin])

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
            All sessions are virtual (Google Meet) — the map shows where MindCraft is based and helps you find a
            tutor whose schedule and subjects fit.
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
            <h2 className={s.sectionTitle}>Available Tutors</h2>
            {rankedTutors.map(tutor => (
              <div
                key={tutor.id}
                className={`${s.tutorListCard} ${selectedId === tutor.id ? s.tutorListCardActive : ''}`}
                onClick={() => setSelectedId(tutor.id)}
              >
                <div className={s.tutorHeader}>
                  <div className={s.avatar} style={{ background: tutor.avatarColor }}>
                    {tutor.displayName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <div className={s.tutorHeaderText}>
                    <div className={s.tutorName}>{tutor.displayName}</div>
                    <div className={s.tutorStat}>
                      {tutor.available ? `${tutor.sessionsCompleted}+ sessions` : 'Unavailable right now'}
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
                    <span className={s.reviewsCount}>{tutor.reviews.length} review{tutor.reviews.length === 1 ? '' : 's'}</span>
                  ) : (
                    <span className={s.reviewsEmpty}>No reviews yet — be the first to book</span>
                  )}
                </div>
                <button
                  className={`${s.bookBtn} ${!tutor.available ? s.bookBtnDisabled : ''}`}
                  disabled={!tutor.available}
                  onClick={e => { e.stopPropagation(); if (tutor.available) loadCalendly(tutor.calendlyUrl) }}
                >
                  {tutor.available ? 'Book Free Session →' : 'Booking Opens Soon'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={s.footer}>
        Already have an account?{' '}
        <Link to="/login">Sign in to your dashboard →</Link>
      </div>

    </div>
  )
}
