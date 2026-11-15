/** 내비 모드 현재 위치: 진행 방향을 가리키는 화살표. 회전은 MapLibre Marker가 지도 방위에 맞춘다. */
export function NavigationArrowMarker() {
  return <span className="hike-nav-arrow" role="img" aria-label="현재 위치와 진행 방향">
    <span className="hike-nav-arrow__halo" aria-hidden="true" />
    <svg className="hike-nav-arrow__icon" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 4 L33 34 L20 27 L7 34 Z" />
    </svg>
  </span>;
}
