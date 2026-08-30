/**
 * Dubai drop zones and distance maths.
 *
 * Context.dev supplies each supplier's real street address and receiving
 * hours; this module maps a named Dubai zone to a representative coordinate
 * so distances are computed rather than asserted. Shipment data is synthetic
 * per the event rules; the supplier addresses and hours are real.
 */

export const DEPOT = { name: "Al Quoz Consolidation Hub", lat: 25.13, lng: 55.22 };

export const ZONES: Record<string, { lat: number; lng: number }> = {
  "Jumeirah Lake Towers": { lat: 25.0693, lng: 55.14 },
  "Dubai Marina": { lat: 25.0805, lng: 55.1403 },
  "Business Bay": { lat: 25.1857, lng: 55.2645 },
  DIFC: { lat: 25.211, lng: 55.2796 },
  Deira: { lat: 25.2697, lng: 55.3095 },
  "Al Quoz": { lat: 25.14, lng: 55.23 },
  "Jebel Ali": { lat: 25.01, lng: 55.06 },
  "Dubai Silicon Oasis": { lat: 25.118, lng: 55.378 },
  "Downtown Dubai": { lat: 25.1972, lng: 55.2744 },
  Mirdif: { lat: 25.217, lng: 55.42 },
};

export function zoneCoords(zone: string) {
  return ZONES[zone] ?? DEPOT;
}

/** Great-circle distance in km. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Road distance is longer than straight-line. 1.35 is a common urban
 * detour factor and is applied consistently to baseline and consolidated
 * figures so the comparison stays honest.
 */
export const DETOUR_FACTOR = 1.35;

/**
 * Diesel light commercial vehicle, well-to-wheel.
 * UK DEFRA 2024 factors put a diesel van at roughly 0.25 kg CO2e per km.
 */
export const CO2_KG_PER_KM = 0.25;

export function roadKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return haversineKm(a, b) * DETOUR_FACTOR;
}

/**
 * Coarse geocoding for Dubai industrial and commercial areas.
 *
 * Context.dev returns a real street address; we match the area name to a
 * representative coordinate so route distances are computed from real
 * locations. This is deliberately coarse - it is area-level, not rooftop.
 */
const AREA_COORDS: { match: string[]; lat: number; lng: number }[] = [
  { match: ["umm ramool", "airport road"], lat: 25.238, lng: 55.356 },
  { match: ["al rigga", "deira", "al ghurair"], lat: 25.2697, lng: 55.3095 },
  { match: ["jebel ali", "national industries park"], lat: 25.01, lng: 55.06 },
  { match: ["yalayas", "dubai industrial"], lat: 24.93, lng: 55.15 },
  { match: ["al quoz"], lat: 25.14, lng: 55.23 },
  { match: ["dubai investments park", "dip"], lat: 24.98, lng: 55.16 },
  { match: ["ras al khor"], lat: 25.18, lng: 55.34 },
  { match: ["al qusais"], lat: 25.28, lng: 55.38 },
  { match: ["business bay"], lat: 25.1857, lng: 55.2645 },
  { match: ["difc", "trade centre"], lat: 25.211, lng: 55.2796 },
  { match: ["silicon oasis"], lat: 25.118, lng: 55.378 },
  { match: ["jumeirah lake towers", "jlt"], lat: 25.0693, lng: 55.14 },
  { match: ["dubai marina"], lat: 25.0805, lng: 55.1403 },
  { match: ["al khaleej", "port saeed"], lat: 25.2532, lng: 55.3305 },
  { match: ["jafza", "jebel ali free zone"], lat: 25.0, lng: 55.05 },
  { match: ["al barsha"], lat: 25.1107, lng: 55.1962 },
  { match: ["umm al quwain"], lat: 25.5652, lng: 55.5533 },
  { match: ["al ain"], lat: 24.2075, lng: 55.7447 },
  { match: ["mussafah"], lat: 24.3517, lng: 54.5064 },
  { match: ["sharjah"], lat: 25.3463, lng: 55.4209 },
  { match: ["abu dhabi"], lat: 24.4539, lng: 54.3773 },
];

export function geocodeAddress(
  address: string | undefined,
): { lat: number; lng: number; area: string } | null {
  if (!address) return null;
  const a = address.toLowerCase();
  for (const entry of AREA_COORDS) {
    for (const m of entry.match) {
      if (a.includes(m)) return { lat: entry.lat, lng: entry.lng, area: m };
    }
  }
  return null;
}
