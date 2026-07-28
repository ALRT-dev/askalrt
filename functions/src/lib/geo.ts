/**
 * PURE geometry helpers — no dependencies. Used by proximity evaluation.
 * Coordinates are {lat, lng} in degrees. Polygons are GeoJSON-style rings:
 * an array of rings, each ring an array of [lng, lat] positions.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

/** GeoJSON Polygon coordinates: rings of [lng, lat] positions. */
export type PolygonRings = number[][][];

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres (haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ray-casting point-in-ring test. `ring` is [lng, lat] positions. */
function pointInRing(point: LatLng, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = [ring[i][0], ring[i][1]]; // lng, lat
    const [xj, yj] = [ring[j][0], ring[j][1]];
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Point-in-polygon with hole support: inside the first (outer) ring and not
 * inside any subsequent (hole) ring.
 */
export function pointInPolygon(point: LatLng, rings: PolygonRings): boolean {
  if (!rings.length || !rings[0].length) return false;
  if (!pointInRing(point, rings[0])) return false;
  for (let r = 1; r < rings.length; r++) {
    if (pointInRing(point, rings[r])) return false; // inside a hole
  }
  return true;
}
