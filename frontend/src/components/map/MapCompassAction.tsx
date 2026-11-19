import { useEffect, useSyncExternalStore } from 'react'
import { compassStore, isRotated, resetNorth } from './compassStore'

/** 지도 나침반 바늘 (내비 화살표가 북쪽을 가리킨다) */
export function CompassNeedle({ bearing }: { bearing: number }) {
  // 화살표만 화면 기준 북쪽으로 돌리고 N 글자는 바로 세워 둔다.
  return <span className="af-map-compass__needle" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="18" height="18" style={{ transform: `rotate(${-bearing}deg)` }}><path d="M12 2.5 19 20.5 12 16.6 5 20.5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
    <span>N</span>
  </span>
}

/**
 * 오른쪽 지도 도구 맨 아래에 두는 정북 맞춤 버튼. 지도가 돌아가 있을 때만 보인다.
 * 이 버튼이 있는 화면에서는 BaseMap이 지도 위 나침반을 따로 그리지 않는다.
 */
export function MapCompassAction() {
  useEffect(() => compassStore.addSlot(), [])
  const { map, bearing } = useSyncExternalStore(compassStore.subscribe, compassStore.get, compassStore.get)
  if (!map || !isRotated(bearing)) return null
  return <button type="button" className="af-map-action af-map-action--neutral af-map-compass"
    aria-label="지도를 정북 방향으로 맞추기" title="정북 방향으로"
    onClick={(event) => resetNorth(map, event.nativeEvent)}>
    <CompassNeedle bearing={bearing} />
  </button>
}
