/**
 * Interactive work-area pin for tutors (Find a Tutor map).
 * Search a place, drag the pin, save lat/lng + address to users/{uid}.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  GoogleMap,
  MarkerF,
  Autocomplete,
  useLoadScript,
  type Libraries,
} from '@react-google-maps/api'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { STUDIO_LOCATION } from '../pages/FindTutor'
import type { LatLng } from '../lib/geo'
import s from './TutorLocationPin.module.css'

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || ''
const MAP_LIBRARIES: Libraries = ['places']
const MAP_STYLE = { width: '100%', height: '100%' }

type Props = {
  uid: string
  initialLatLng: LatLng | null
  initialAddress: string | null
  onSaved: (latLng: LatLng, address: string) => void
  onToast: (msg: string) => void
}

export default function TutorLocationPin({
  uid,
  initialLatLng,
  initialAddress,
  onSaved,
  onToast,
}: Props) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
  })
  const [pin, setPin] = useState<LatLng>(initialLatLng ?? STUDIO_LOCATION)
  const [address, setAddress] = useState(initialAddress ?? '')
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initialLatLng) setPin(initialLatLng)
    if (initialAddress) setAddress(initialAddress)
  }, [initialLatLng, initialAddress])

  const reverseGeocode = useCallback(async (latLng: LatLng) => {
    if (!GOOGLE_MAPS_API_KEY || !window.google?.maps) return
    try {
      const geocoder = new google.maps.Geocoder()
      const res = await geocoder.geocode({ location: latLng })
      const formatted = res.results?.[0]?.formatted_address
      if (formatted) setAddress(formatted)
    } catch {
      /* keep prior address */
    }
  }, [])

  async function save() {
    setSaving(true)
    try {
      const formatted = address.trim() || `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`
      await updateDoc(doc(db, 'users', uid), {
        location: { lat: pin.lat, lng: pin.lng },
        locationAddress: formatted,
      })
      onSaved(pin, formatted)
      onToast('Location pinned. Students can find you here')
    } catch {
      onToast('Could not save location')
    } finally {
      setSaving(false)
    }
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className={s.wrap}>
        <p className={s.hint}>Maps key missing in this environment. Add VITE_GOOGLE_MAPS_API_KEY to enable pin.</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className={s.wrap}>
        <p className={s.hint}>Map failed to load. Refresh and try again.</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className={s.wrap}>
        <p className={s.hint}>Loading map…</p>
      </div>
    )
  }

  return (
    <div className={s.wrap}>
      <p className={s.hint}>Search a general area, then drag the pin to where you work from.</p>
      <Autocomplete
        onLoad={setAutocomplete}
        onPlaceChanged={() => {
          const place = autocomplete?.getPlace()
          const loc = place?.geometry?.location
          if (!loc) return
          const next = { lat: loc.lat(), lng: loc.lng() }
          setPin(next)
          setAddress(place.formatted_address || place.name || address)
        }}
      >
        <input
          className={s.search}
          type="text"
          placeholder="City, neighborhood, or address"
          defaultValue={address}
        />
      </Autocomplete>
      <div className={s.mapFrame}>
        <GoogleMap
          mapContainerStyle={MAP_STYLE}
          center={pin}
          zoom={11}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          }}
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
      {address && <p className={s.address}>{address}</p>}
      <button type="button" className={s.save} disabled={saving} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save pin'}
      </button>
    </div>
  )
}
