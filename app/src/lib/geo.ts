/**
 * geo.ts — small geo helpers for Find a Tutor (and anywhere else that needs
 * a plain-JS distance calc without pulling in the Google Maps SDK).
 */

export interface LatLng {
  lat: number
  lng: number
}

const EARTH_RADIUS_KM = 6371

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Great-circle distance between two lat/lng points, in kilometers. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function kmToMiles(km: number): number {
  return km * 0.621371
}

export function formatDistanceMiles(km: number): string {
  const mi = kmToMiles(km)
  if (mi < 0.1) return 'at this location'
  if (mi < 10) return `${mi.toFixed(1)} mi away`
  return `${Math.round(mi)} mi away`
}

/** Rough US state from a search label ("El Cerrito, CA", "California", …). */
export function usStateFromLabel(label: string): string | null {
  const s = label.trim().toLowerCase()
  if (!s) return null
  if (/\bcalifornia\b|\bca\b/.test(s)) return 'CA'
  if (/\bminnesota\b|\bmn\b/.test(s)) return 'MN'
  // ZIP prefixes (common for our current tutor regions)
  if (/\b9[0-6]\d{3}\b/.test(s)) return 'CA'
  if (/\b5[5-6]\d{3}\b/.test(s)) return 'MN'
  return null
}

/** Rough US state from lat/lng (covers CA + MN tightly enough for tutor routing). */
export function usStateFromLatLng(loc: LatLng): string | null {
  const { lat, lng } = loc
  if (lat >= 32.5 && lat <= 42.1 && lng >= -124.6 && lng <= -114.0) return 'CA'
  if (lat >= 43.4 && lat <= 49.5 && lng >= -97.3 && lng <= -89.4) return 'MN'
  return null
}

/**
 * Tutors nearest to the search point, closest first.
 * With a search origin: return the nearest tutor, plus any others within
 * `nearbyMiles` (so a CA search shows the Bay Area pin, not Minnesota).
 * Without a search: return everyone (unsorted distances = 0).
 */
export function filterTutorsForSearch<T extends { location: LatLng; state?: string | null }>(
  tutors: T[],
  origin: LatLng | null,
  _label = '',
  nearbyMiles = 250,
): (T & { distanceKm: number })[] {
  if (!origin) {
    return tutors.map(t => ({ ...t, distanceKm: 0 }))
  }

  const ranked = tutors
    .map(t => ({ ...t, distanceKm: haversineKm(origin, t.location) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)

  if (!ranked.length) return ranked

  const nearest = ranked[0]
  const alsoNearby = ranked.slice(1).filter(t => kmToMiles(t.distanceKm) <= nearbyMiles)
  return [nearest, ...alsoNearby]
}
