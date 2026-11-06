import './CurrentLocationMarker.css'

export function CurrentLocationMarker() {
  return <span className="current-location-marker" role="img" aria-label="현재 위치">
    <span className="current-location-marker__pulse" aria-hidden="true" />
    <span className="current-location-marker__pulse" aria-hidden="true" />
    <span className="current-location-marker__dot" aria-hidden="true" />
  </span>
}
