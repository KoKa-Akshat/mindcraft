/**
 * TutorEventsPanel.tsx (TUTORS_EVENTS build, 2026-08-31; tutorEvents
 * generalized to any signed-in host, 2026-09-02, see pages/Events.tsx)
 *
 * The tutor's "Create Event" tab: pin a spot on the map (a cafe, a library,
 * campus), give it a title and a time window, and set it live. Live events
 * land in the `tutorEvents` collection (name kept for continuity, no longer
 * tutor-exclusive), which the app's Events page reads with onSnapshot, so a
 * posted event shows up on every signed-in user's map the moment it saves.
 *
 * Map interaction reuses the exact pattern TutorLocationPin.tsx shipped:
 * same @react-google-maps/api loader and key, Autocomplete search, click to
 * drop the pin, drag to fine-tune, reverse geocode for a readable label.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  GoogleMap,
  MarkerF,
  Autocomplete,
  useLoadScript,
  type Libraries,
} from '@react-google-maps/api'
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, where,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from '../firebase'
import { STUDIO_LOCATION } from '../pages/FindTutor'
import type { LatLng } from '../lib/geo'
import s from './TutorEventsPanel.module.css'

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || ''
const MAP_LIBRARIES: Libraries = ['places']
const MAP_STYLE = { width: '100%', height: '100%' }

const SAVE_ERROR_HINT = 'Could not save the event. Check your connection and try again.'

interface TutorEvent {
  id: string
  title: string
  notes: string
  locationLabel: string
  lat: number
  lng: number
  startAt: number
  endAt: number
}

type Props = {
  user: User
  tutorName: string
  initialLatLng: LatLng | null
  onToast: (msg: string) => void
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

export default function TutorEventsPanel({ user, tutorName, initialLatLng, onToast }: Props) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
  })

  const [pin, setPin] = useState<LatLng>(initialLatLng ?? STUDIO_LOCATION)
  const [locationLabel, setLocationLabel] = useState('')
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(todayIso())
  const [startTime, setStartTime] = useState('16:00')
  const [endTime, setEndTime] = useState('17:30')
  const [saving, setSaving] = useState(false)
  const [events, setEvents] = useState<TutorEvent[]>([])
  const [listBlocked, setListBlocked] = useState(false)

  // Own events, live. Sorted client-side so no composite index is needed.
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'tutorEvents'), where('hostId', '==', user.uid)),
      snap => {
        setListBlocked(false)
        setEvents(
          snap.docs
            .map(d => {
              const data = d.data() as Record<string, unknown>
              return {
                id: d.id,
                title: String(data.title ?? ''),
                notes: typeof data.notes === 'string' ? data.notes : '',
                locationLabel: typeof data.locationLabel === 'string' ? data.locationLabel : '',
                lat: Number(data.lat),
                lng: Number(data.lng),
                startAt: Number(data.startAt) || 0,
                endAt: Number(data.endAt) || 0,
              }
            })
            .sort((a, b) => a.startAt - b.startAt),
        )
      },
      () => setListBlocked(true),
    )
    return unsub
  }, [user.uid])

  const upcoming = useMemo(() => events.filter(ev => ev.endAt >= Date.now()), [events])
  const past = useMemo(() => events.filter(ev => ev.endAt < Date.now()), [events])

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

  async function createEvent() {
    const cleanTitle = title.trim()
    if (!cleanTitle) {
      onToast('Give the event a title first')
      return
    }
    const startAt = new Date(`${date}T${startTime}`).getTime()
    const endAt = new Date(`${date}T${endTime}`).getTime()
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) {
      onToast('Pick a real date and time')
      return
    }
    if (endAt <= startAt) {
      onToast('The end time has to be after the start')
      return
    }
    if (endAt < Date.now()) {
      onToast('That time is already in the past')
      return
    }
    setSaving(true)
    try {
      await addDoc(collection(db, 'tutorEvents'), {
        hostId: user.uid,
        hostName: tutorName,
        title: cleanTitle,
        notes: notes.trim(),
        locationLabel: locationLabel.trim() || `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`,
        lat: pin.lat,
        lng: pin.lng,
        startAt,
        endAt,
        createdAt: serverTimestamp(),
      })
      setTitle('')
      setNotes('')
      onToast('Event is live. Students see it on their map now')
    } catch {
      onToast(SAVE_ERROR_HINT)
    } finally {
      setSaving(false)
    }
  }

  async function endEvent(id: string) {
    try {
      await deleteDoc(doc(db, 'tutorEvents', id))
      onToast('Event taken down')
    } catch {
      onToast('Could not remove the event. Try again')
    }
  }

  return (
    <div className={s.wrap}>
      <div className={s.card}>
        <div className={s.cardHead}>
          <span className={s.cardLabel}>Create an event</span>
        </div>
        <p className={s.hint}>
          Office hours at a cafe, a study meetup, an ACT cram night. Pin where it happens,
          set the window, and it goes live on every student&apos;s map.
        </p>

        <div className={s.formGrid}>
          <label className={s.field}>
            <span>Title</span>
            <input
              className={s.input}
              type="text"
              maxLength={120}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Open office hours · algebra and ACT math"
            />
          </label>
          <label className={s.field}>
            <span>Date</span>
            <input className={s.input} type="date" min={todayIso()} value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <div className={s.timeRow}>
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
            <span>Notes for students</span>
            <textarea
              className={s.textarea}
              rows={2}
              maxLength={280}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Drop in any time. I will have practice sets printed."
            />
          </label>
        </div>

        {!GOOGLE_MAPS_API_KEY ? (
          <p className={s.hint}>Maps key missing in this environment. Add VITE_GOOGLE_MAPS_API_KEY to enable the pin.</p>
        ) : loadError ? (
          <p className={s.hint}>Map failed to load. Refresh and try again.</p>
        ) : !isLoaded ? (
          <p className={s.hint}>Loading map…</p>
        ) : (
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
              <input
                className={s.input}
                type="text"
                placeholder="Search the spot · cafe, library, campus building"
              />
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
              <span>Location label students see</span>
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
          {saving ? 'Setting live…' : 'Set it live'}
        </button>
      </div>

      <div className={s.card}>
        <div className={s.cardHead}>
          <span className={s.cardLabel}>Your events</span>
        </div>
        {listBlocked ? (
          <p className={s.hint}>Could not load your events. Refresh and try again.</p>
        ) : upcoming.length === 0 && past.length === 0 ? (
          <p className={s.hint}>Nothing posted yet. Your first event shows here and on every student map.</p>
        ) : (
          <div className={s.eventList}>
            {upcoming.map(ev => (
              <div key={ev.id} className={s.eventRow}>
                <div className={s.eventWho}>
                  <strong>{ev.title}</strong>
                  <em>{fmtWhen(ev.startAt, ev.endAt)}</em>
                  {ev.locationLabel && <em>{ev.locationLabel}</em>}
                </div>
                <span className={s.liveBadge}>{ev.startAt <= Date.now() ? 'Happening now' : 'Live on maps'}</span>
                <button type="button" className={s.endBtn} onClick={() => void endEvent(ev.id)}>
                  Take down
                </button>
              </div>
            ))}
            {past.map(ev => (
              <div key={ev.id} className={`${s.eventRow} ${s.eventPast}`}>
                <div className={s.eventWho}>
                  <strong>{ev.title}</strong>
                  <em>{fmtWhen(ev.startAt, ev.endAt)}</em>
                </div>
                <span className={s.pastBadge}>Ended</span>
                <button type="button" className={s.endBtn} onClick={() => void endEvent(ev.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
