export type RoutePoint = readonly [number, number];

export interface RouteMetrics {
  coordinates: RoutePoint[];
  cumulativeMeters: number[];
  totalMeters: number;
  valid: boolean;
  closed: boolean;
}

export interface RouteSample {
  coordinate: [number, number];
  bearing: number;
}

const EARTH_RADIUS_METERS = 6_371_008.8;
const radians = (degrees: number) => degrees * Math.PI / 180;
const normalizeBearing = (degrees: number) => ((degrees % 360) + 360) % 360;

export function shortestBearingDelta(from: number, to: number): number {
  return ((to - from) % 360 + 540) % 360 - 180;
}

export function interpolateBearing(from: number, to: number, progress: number): number {
  return normalizeBearing(from + shortestBearingDelta(from, to) * Math.max(0, Math.min(1, progress)));
}

function samePosition(first: RoutePoint, second: RoutePoint): boolean {
  return first[1] === second[1] && shortestBearingDelta(first[0], second[0]) === 0;
}

function segmentMeters(first: RoutePoint, second: RoutePoint): number {
  const latitudeDelta = radians(second[1] - first[1]);
  const longitudeDelta = radians(shortestBearingDelta(first[0], second[0]));
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(first[1])) * Math.cos(radians(second[1])) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.max(0, Math.min(1, haversine))));
}

function segmentBearing(first: RoutePoint, second: RoutePoint): number {
  const longitudeDelta = radians(shortestBearingDelta(first[0], second[0]));
  const fromLatitude = radians(first[1]);
  const toLatitude = radians(second[1]);
  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude);
  const x = Math.cos(fromLatitude) * Math.sin(toLatitude)
    - Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta);
  return normalizeBearing(Math.atan2(y, x) * 180 / Math.PI);
}

/** Display-only distance index: keeps every original vertex and does not smooth the route. */
export function buildRouteMetrics(points: readonly RoutePoint[]): RouteMetrics {
  if (!Array.isArray(points) || points.length < 2 || points.some(point => !Array.isArray(point)
    || point.length !== 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1])
    || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90)) {
    return { coordinates: [], cumulativeMeters: [], totalMeters: 0, valid: false, closed: false };
  }
  const coordinates: RoutePoint[] = points.map(point => [point[0], point[1]]);
  const cumulativeMeters = [0];
  for (let index = 1; index < coordinates.length; index += 1) {
    cumulativeMeters.push(cumulativeMeters[index - 1] + segmentMeters(coordinates[index - 1], coordinates[index]));
  }
  const totalMeters = cumulativeMeters[cumulativeMeters.length - 1];
  const valid = totalMeters > 0 && Number.isFinite(totalMeters);
  // Closure is exact coordinate equality (±180 equivalent), not a safety/distance threshold.
  const closed = valid && samePosition(coordinates[0], coordinates[coordinates.length - 1]);
  return { coordinates, cumulativeMeters, totalMeters, valid, closed };
}

/** Distance selects the original segment; interpolation never skips or rounds route vertices. */
export function sampleRouteAt(metrics: RouteMetrics, distanceMeters: number): RouteSample | null {
  if (!metrics.valid || Number.isNaN(distanceMeters)) return null;
  const { coordinates, cumulativeMeters, totalMeters } = metrics;
  const distance = Math.max(0, Math.min(totalMeters, distanceMeters));
  let segmentEnd: number;
  if (distance === totalMeters) {
    // At the final position, keep the last nonzero segment's incoming bearing.
    segmentEnd = coordinates.length - 1;
    while (segmentEnd > 1 && cumulativeMeters[segmentEnd - 1] === totalMeters) segmentEnd -= 1;
  } else {
    // Upper bound skips all consecutive zero-length segments, including at the start.
    let low = 1;
    let high = cumulativeMeters.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (cumulativeMeters[middle] > distance) high = middle;
      else low = middle + 1;
    }
    segmentEnd = low;
  }
  const first = coordinates[segmentEnd - 1];
  const second = coordinates[segmentEnd];
  const segmentLength = cumulativeMeters[segmentEnd] - cumulativeMeters[segmentEnd - 1];
  const progress = (distance - cumulativeMeters[segmentEnd - 1]) / segmentLength;
  let coordinate: [number, number];
  if (distance === totalMeters) {
    coordinate = [...coordinates[coordinates.length - 1]];
  } else if (progress === 0) {
    coordinate = [...first];
  } else {
    const longitude = first[0] + shortestBearingDelta(first[0], second[0]) * progress;
    coordinate = [longitude > 180 ? longitude - 360 : longitude < -180 ? longitude + 360 : longitude,
      first[1] + (second[1] - first[1]) * progress];
  }
  return { coordinate, bearing: segmentBearing(first, second) };
}

export function arrowSamples(metrics: RouteMetrics, count = 3): RouteSample[] {
  if (!metrics.valid || !Number.isSafeInteger(count) || count <= 0) return [];
  const result: RouteSample[] = [];
  for (let index = 1; index <= count; index += 1) {
    const sample = sampleRouteAt(metrics, metrics.totalMeters * index / (count + 1));
    // Out-and-back routes can put opposite arrows at exactly the same location.
    if (sample && !result.some(existing => samePosition(existing.coordinate, sample.coordinate))) result.push(sample);
  }
  return result;
}
