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
