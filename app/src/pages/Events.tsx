/**
 * pages/Events.tsx
 *
 * "Broadcast a live event to anyone nearby": pin a spot on the map, give it
 * a title, a description, and a time window, and it shows up on every
 * signed-in user's map for that window. Generalizes the tutor-only
 * TutorEventsPanel.tsx flow (office hours, study meetups) to any student or
 * tutor (2026-09-02 founder decision), reusing the exact same
 * @react-google-maps/api pattern (Autocomplete, click-to-drop, drag to
 * adjust, reverse geocode) and the same `tutorEvents` Firestore collection,
 * now keyed by hostId/hostName instead of tutorId/tutorName, see that
 * component's own header comment and the firestore.rules block for the
 * generalized permission model (any signed-in user can create, capped at a
 * 24h window as an abuse rail; delete/update stay with the creator).
 *
 * This page is the previously-missing consumer: the rules and the tutor
 * write-path already existed, but nothing ever showed events back to
 * students. This is that map.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  GoogleMap,
  MarkerF,
  InfoWindowF,
  Autocomplete,
  useLoadScript,
  type Libraries,
} from '@react-google-maps/api'
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp,
} from 'firebase/firestore'
import { useUser } from '../App'
import { db } from '../firebase'
import Sidebar from '../components/Sidebar'
import AppTabBar from '../components/AppTabBar'
import { STUDIO_LOCATION } from './FindTutor'
import type { LatLng } from '../lib/geo'
import s from './Events.module.css'

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || ''
const MAP_LIBRARIES: Libraries = ['places']
const MAP_STYLE = { width: '100%', height: '100%' }
/** The outer, page-filling map sits in a flex-grown container (.mapWrap),
 * whose height is real at layout time but doesn't reliably propagate down
 * through Google's own nested height:100% divs (measured 0 in practice,
 * a known @react-google-maps/api sizing trap). Absolute+inset instead of
 * width/height percentages sidesteps that whole percentage-resolution
 * chain; .mapWrap only needs position:relative for it to anchor to,
 * already true. The modal's small map (.mapFrame) is unaffected, it gets
 * a real height a different way (aspect-ratio) and keeps using MAP_STYLE. */
const MAIN_MAP_STYLE = { position: 'absolute' as const, inset: 0 }
/** Matches the firestore.rules cap: a broadcast can run at most 24 hours. */
const MAX_DURATION_MS = 24 * 60 * 60 * 1000

interface LiveEvent {
  id: string
  hostId: string
  hostName: string
  title: string
  notes: string
  locationLabel: string
  lat: number
  lng: number
  startAt: number
  endAt: number
}

function todayIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function fmtWhen(startAt: number, endAt: number): string {
  const st = new Date(startAt)
  const en = new Date(endAt)
  const day = st.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  const t = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${t(st)} to ${t(en)}`
}

export default function Events() {
  const user = useUser()
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
  })

  const [center, setCenter] = useState<LatLng>(STUDIO_LOCATION)
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [listBlocked, setListBlocked] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const [creating, setCreating] = useState(false)
  const [pin, setPin] = useState<LatLng>(STUDIO_LOCATION)
  const [locationLabel, setLocationLabel] = useState('')
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(todayIso())
  const [startTime, setStartTime] = useState('16:00')
  const [endTime, setEndTime] = useState('17:30')
  const [saving, setSaving] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(''), 3200)
  }

  // Center on the visitor's real location once, if they grant it. Falls
  // back to STUDIO_LOCATION otherwise, same default TutorEventsPanel uses.
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setCenter(here)
        setPin(here)
      },
      () => {},
      { timeout: 8000 },
    )
  }, [])

  // Every currently-live-or-upcoming event, from every host. Filtered and
  // sorted client-side so no composite Firestore index is needed.
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'tutorEvents'),
      snap => {
        setListBlocked(false)
        const now = Date.now()
        setEvents(
          snap.docs
            .map(d => {
              const data = d.data() as Record<string, unknown>
              return {
                id: d.id,
                hostId: String(data.hostId ?? ''),
                hostName: String(data.hostName ?? 'A MindCraft user'),
                title: String(data.title ?? ''),
                notes: typeof data.notes === 'string' ? data.notes : '',
                locationLabel: typeof data.locationLabel === 'string' ? data.locationLabel : '',
                lat: Number(data.lat),
                lng: Number(data.lng),
                startAt: Number(data.startAt) || 0,
                endAt: Number(data.endAt) || 0,
              }
            })
            .filter(ev => ev.endAt >= now && Number.isFinite(ev.lat) && Number.isFinite(ev.lng))
            .sort((a, b) => a.startAt - b.startAt),
        )
      },
      () => setListBlocked(true),
    )
    return unsub
  }, [])

  const selected = useMemo(() => events.find(ev => ev.id === selectedId) ?? null, [events, selectedId])

  const reverseGeocode = useCallback(async (latLng: LatLng) => {
    if (!GOOGLE_MAPS_API_KEY || !window.google?.maps) return
    try {
      const geocoder = new google.maps.Geocoder()
      const res = await geocoder.geocode({ location: latLng })
      const formatted = res.results?.[0]?.formatted_address
      if (formatted) setLocationLabel(formatted)
    } catch {
      /* keep prior label */
    }
  }, [])

  function openCreate() {
    setPin(center)
    setLocationLabel('')
    setTitle('')
    setNotes('')
    setDate(todayIso())
    setStartTime('16:00')
    setEndTime('17:30')
    setCreating(true)
  }

  async function createEvent() {
    if (!user) return
    const cleanTitle = title.trim()
    if (!cleanTitle) {
      showToast('Give the event a title first')
      return
    }
    const startAt = new Date(`${date}T${startTime}`).getTime()
    const endAt = new Date(`${date}T${endTime}`).getTime()
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) {
      showToast('Pick a real date and time')
      return
    }
    if (endAt <= startAt) {
      showToast('The end time has to be after the start')
      return
    }
    if (endAt < Date.now()) {
      showToast('That time is already in the past')
      return
    }
    if (endAt - startAt > MAX_DURATION_MS) {
      showToast('Events can run for at most 24 hours')
      return
    }
    setSaving(true)
    try {
      await addDoc(collection(db, 'tutorEvents'), {
        hostId: user.uid,
        hostName: user.displayName || user.email?.split('@')[0] || 'A MindCraft user',
        title: cleanTitle,
        notes: notes.trim(),
        locationLabel: locationLabel.trim() || `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`,
        lat: pin.lat,
        lng: pin.lng,
        startAt,
        endAt,
        createdAt: serverTimestamp(),
      })
      setCreating(false)
      showToast('Event is live on the map')
    } catch {
      showToast('Could not save the event. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEvent(id: string) {
    try {
      await deleteDoc(doc(db, 'tutorEvents', id))
      setSelectedId(null)
      showToast('Event taken down')
    } catch {
      showToast('Could not remove the event. Try again')
    }
  }

  if (!user) return null

  return (
    <div className={s.shell}>
      <Sidebar />
      <main className={s.page}>
        <AppTabBar active="events" />
        <div className={s.mapWrap}>
          {!GOOGLE_MAPS_API_KEY ? (
            <p className={s.hint}>Maps key missing in this environment.</p>
          ) : loadError ? (
            <p className={s.hint}>Map failed to load. Refresh and try again.</p>
          ) : !isLoaded ? (
            <p className={s.hint}>Loading map…</p>
          ) : (
            <GoogleMap
              mapContainerStyle={MAIN_MAP_STYLE}
              center={center}
              zoom={13}
              options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
            >
              {events.map(ev => (
                <MarkerF key={ev.id} position={{ lat: ev.lat, lng: ev.lng }} onClick={() => setSelectedId(ev.id)} />
              ))}
              {selected && (
                <InfoWindowF
                  position={{ lat: selected.lat, lng: selected.lng }}
                  onCloseClick={() => setSelectedId(null)}
                >
                  <div className={s.infoCard}>
                    <strong>{selected.title}</strong>
                    <em>{fmtWhen(selected.startAt, selected.endAt)}</em>
                    {selected.locationLabel && <em>{selected.locationLabel}</em>}
                    {selected.notes && <p>{selected.notes}</p>}
                    <span className={s.hostedBy}>Hosted by {selected.hostName}</span>
                    {selected.hostId === user.uid && (
                      <button type="button" className={s.takeDownBtn} onClick={() => void deleteEvent(selected.id)}>
                        Take down
                      </button>
                    )}
                  </div>
                </InfoWindowF>
              )}
            </GoogleMap>
          )}

          {listBlocked && <p className={s.hint}>Could not load events. Refresh and try again.</p>}

          <button type="button" className={s.fab} aria-label="Broadcast an event" onClick={openCreate}>
            +
          </button>

          {toast && <div className={s.toast}>{toast}</div>}

          {creating && (
            <div className={s.overlay} onClick={() => !saving && setCreating(false)}>
              <div className={s.modal} onClick={e => e.stopPropagation()}>
                <div className={s.modalHead}>
                  <span>Broadcast an event</span>
                  <button type="button" className={s.closeBtn} onClick={() => setCreating(false)} aria-label="Close">
                    ×
                  </button>
                </div>
                <p className={s.hint}>
                  Pin where it happens, give it a name and a window, and it goes live on everyone&apos;s map nearby.
                </p>

                <label className={s.field}>
                  <span>Title</span>
                  <input
                    className={s.input}
                    type="text"
                    maxLength={120}
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Study session · calc + linear algebra"
                  />
                </label>
                <div className={s.timeRow}>
                  <label className={s.field}>
                    <span>Date</span>
                    <input className={s.input} type="date" min={todayIso()} value={date} onChange={e => setDate(e.target.value)} />
                  </label>
                  <label className={s.field}>
                    <span>Starts</span>
                    <input className={s.input} type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                  </label>
                  <label className={s.field}>
                    <span>Ends</span>
                    <input className={s.input} type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                  </label>
                </div>
                <label className={s.field}>
                  <span>Description</span>
                  <textarea
                    className={s.textarea}
                    rows={2}
                    maxLength={280}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Drop in any time, bring your own laptop."
                  />
                </label>

                {GOOGLE_MAPS_API_KEY && isLoaded && (
                  <>
                    <Autocomplete
                      onLoad={setAutocomplete}
                      onPlaceChanged={() => {
                        const place = autocomplete?.getPlace()
                        const loc = place?.geometry?.location
                        if (!loc) return
                        const next = { lat: loc.lat(), lng: loc.lng() }
                        setPin(next)
                        setLocationLabel(place.formatted_address || place.name || locationLabel)
                      }}
                    >
                      <input className={s.input} type="text" placeholder="Search the spot · cafe, library, campus building" />
                    </Autocomplete>
                    <div className={s.mapFrame}>
                      <GoogleMap
                        mapContainerStyle={MAP_STYLE}
                        center={pin}
                        zoom={13}
                        options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
                        onClick={e => {
                          const lat = e.latLng?.lat()
                          const lng = e.latLng?.lng()
                          if (lat == null || lng == null) return
                          const next = { lat, lng }
                          setPin(next)
                          void reverseGeocode(next)
                        }}
                      >
                        <MarkerF
                          position={pin}
                          draggable
                          onDragEnd={e => {
                            const lat = e.latLng?.lat()
                            const lng = e.latLng?.lng()
                            if (lat == null || lng == null) return
                            const next = { lat, lng }
                            setPin(next)
                            void reverseGeocode(next)
                          }}
                        />
                      </GoogleMap>
                    </div>
                    <label className={s.field}>
                      <span>Location label others see</span>
                      <input
                        className={s.input}
                        type="text"
                        maxLength={140}
                        value={locationLabel}
                        onChange={e => setLocationLabel(e.target.value)}
                        placeholder="Cahoots Coffee, Selby Ave, St Paul"
                      />
                    </label>
                  </>
                )}

                <button type="button" className={s.primary} disabled={saving} onClick={() => void createEvent()}>
                  {saving ? 'Setting live…' : 'Go live'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
