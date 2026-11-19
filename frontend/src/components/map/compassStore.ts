import type { Map as MapLibreMap } from 'maplibre-gl'

/**
 * 화면의 지도 방위와 정북 맞춤 동작을 지도 바깥(오른쪽 지도 도구)의 나침반 버튼에 알린다.
 * 한 화면에는 손으로 움직이는 지도가 하나라 가장 최근에 만든 지도를 따른다.
 * 오른쪽 지도 도구에 나침반 버튼(MapCompassAction)이 있으면 BaseMap은 지도 위 나침반을 그리지 않는다.
 */
type CompassState = { map: MapLibreMap | null; owner: string | null; bearing: number; slots: number }

let state: CompassState = { map: null, owner: null, bearing: 0, slots: 0 }
const listeners = new Set<() => void>()
const emit = (next: Partial<CompassState>) => {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

export const compassStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  get: () => state,
  attach(map: MapLibreMap, owner: string) { emit({ map, owner, bearing: map.getBearing() }) },
  detach(map: MapLibreMap) { if (state.map === map) emit({ map: null, owner: null, bearing: 0 }) },
  setBearing(map: MapLibreMap, bearing: number) { if (state.map === map) emit({ bearing }) },
  addSlot() {
    emit({ slots: state.slots + 1 })
    return () => emit({ slots: state.slots - 1 })
  },
}

/** 지도가 돌아가 있다고 볼 최소 각도 */
export const isRotated = (bearing: number) => Math.abs(bearing) > 0.5

/** 정북으로 되돌린다. 손으로 돌린 것처럼 알려 등산 내비의 따라가기도 멈춘다. */
export function resetNorth(map: MapLibreMap | null, event?: Event) {
  map?.easeTo({ bearing: 0, duration: 400 }, event ? { originalEvent: event } : undefined)
}
