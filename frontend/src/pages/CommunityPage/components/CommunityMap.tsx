import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { MapLibreMap } from 'maplibre-gl'
import BaseMap, { type MapRoute } from '../../../components/map/BaseMap'
import { MountainMarker, SpotMarker } from '../../../components/map'
import { Icon } from '../../../components/common/Icon'
import { communityCourse } from '../../../api/communityMock'
import type { Coordinate, SegmentStatus, SpotType } from '../../../types/community'

export type CommunityMapMarker = {
  id: string
  name: string
  label?: string
  kind: 'mountain' | 'spot' | 'segment' | 'point'
  coordinate: Coordinate
  spotType?: SpotType
  selected?: boolean
  shortLabel?: string
}

type Props = {
  markers?: readonly CommunityMapMarker[]
  center?: Coordinate
  focusTarget?: { coordinate: Coordinate; request: number; zoom?: number; resetZoom?: boolean }
  zoom?: number
  showRoute?: boolean
  segmentLine?: { coordinates: Coordinate[]; status: SegmentStatus }
  onMarkerSelect?: (id: string) => void
  onMapSelect?: (coordinate: Coordinate) => void
  children?: ReactNode
  className?: string
  ariaLabel?: string
}

const ROUTES: readonly MapRoute[] = [{ id: 'community-baegundae', color: '#19765b', coordinates: [...communityCourse.routeCoordinates] }]
const EMPTY_ROUTES: readonly MapRoute[] = []
const SEGMENT_COLORS: Record<SegmentStatus, string> = { good: '#19765b', caution: '#bf8120', danger: '#b44e62' }
const BASE_ROUTE_LAYER = 'course-route-community-baegundae'
const SEGMENT_ROUTE_LAYER = 'course-route-community-segment-status'
const DEFAULT_CENTER: Coordinate = [126.977, 37.659]
const MARKER_CLUSTER_DISTANCE = 48

type ProjectedMarker = { marker: CommunityMapMarker; x: number; y: number }

function groupNearbyMarkers(markers: readonly ProjectedMarker[]) {
  const remaining = markers.filter(({ marker }) => marker.kind !== 'mountain')
  const groups: ProjectedMarker[][] = []
  for (const marker of remaining) {
    const group = groups.find(items => {
      const centerX = items.reduce((sum, item) => sum + item.x, 0) / items.length
      const centerY = items.reduce((sum, item) => sum + item.y, 0) / items.length
      return Math.hypot(centerX - marker.x, centerY - marker.y) < MARKER_CLUSTER_DISTANCE
    })
    if (group) group.push(marker)
    else groups.push([marker])
  }
  return groups
}

export function CommunityMap({ markers = [], center = DEFAULT_CENTER, focusTarget, zoom = 14, showRoute = true,
  segmentLine, onMarkerSelect, onMapSelect, children, className, ariaLabel = '커뮤니티 예시 지도' }: Props) {
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [projected, setProjected] = useState<ProjectedMarker[]>([])
  const [clusterChoices, setClusterChoices] = useState<CommunityMapMarker[]>([])
  const [mapUnavailable, setMapUnavailable] = useState(false)
  const [mapRetry, setMapRetry] = useState(0)
  const onReady = useCallback((instance: MapLibreMap | null) => { setMap(instance); if (instance) setMapUnavailable(false) }, [])
  const markerSignature = markers.map(marker => `${marker.id}:${marker.coordinate.join(',')}:${marker.selected}`).join('|')
  // MapLibre 객체는 화면별로 유지하고 이동/크기 변경 때만 핀 좌표를 다시 계산한다.
  const markerSnapshot = useMemo(() => markers, [markerSignature]) // eslint-disable-line react-hooks/exhaustive-deps
  const segmentCoordinates = segmentLine?.coordinates
  const segmentStatus = segmentLine?.status
  const routes = useMemo<readonly MapRoute[]>(() => !showRoute ? EMPTY_ROUTES : segmentCoordinates && segmentStatus ? [
    { id: 'community-baegundae', color: '#8ca89c', coordinates: [...communityCourse.routeCoordinates] },
    { id: 'community-segment-status', color: SEGMENT_COLORS[segmentStatus], coordinates: segmentCoordinates },
  ] : ROUTES, [showRoute, segmentCoordinates, segmentStatus])

  useEffect(() => {
    if (!map || !segmentCoordinates || !segmentStatus) return
    const styleSegmentRoute = () => {
      if (map.getLayer(BASE_ROUTE_LAYER) && map.getPaintProperty(BASE_ROUTE_LAYER, 'line-opacity') !== 0.65)
        map.setPaintProperty(BASE_ROUTE_LAYER, 'line-opacity', 0.65)
      if (map.getLayer(SEGMENT_ROUTE_LAYER) && map.getPaintProperty(SEGMENT_ROUTE_LAYER, 'line-width') !== 7)
        map.setPaintProperty(SEGMENT_ROUTE_LAYER, 'line-width', 7)
    }
    map.on('styledata', styleSegmentRoute)
    styleSegmentRoute()
    return () => { map.off('styledata', styleSegmentRoute) }
  }, [map, segmentCoordinates, segmentStatus])

  useEffect(() => {
    if (!map) return
    const update = () => setProjected(markerSnapshot.map(marker => {
      const point = map.project(marker.coordinate)
      return { marker, x: point.x, y: point.y }
    }))
    const observer = new ResizeObserver(() => { map.resize(); update() })
    observer.observe(map.getContainer())
    map.on('move', update)
    map.on('resize', update)
    update()
    return () => { observer.disconnect(); map.off('move', update); map.off('resize', update) }
  }, [map, markerSnapshot])

  useEffect(() => {
    if (!map) return
    const onLoad = () => setMapUnavailable(false)
    const timer = window.setTimeout(() => { if (!map.isStyleLoaded()) setMapUnavailable(true) }, 8000)
    map.on('load', onLoad)
    return () => { window.clearTimeout(timer); map.off('load', onLoad) }
  }, [map])

  useEffect(() => {
    if (!map || !className?.includes('community-page__map')) return
    // 시트는 지도 위 오버레이이므로 시트의 높이로 카메라 중심을 옮기지 않는다.
    map.setPadding({ top: 0, right: 0, bottom: 0, left: 0 })
  }, [map, className])

  useEffect(() => {
    if (!map || !focusTarget || !(className?.includes('community-page__map--select') || className?.includes('community-page__map--main') || className?.includes('community-page__map--detail-mountain') || className?.includes('community-page__map--detail-spot') || className?.includes('community-page__map--detail-segment'))) return
    const mapRect = map.getContainer().getBoundingClientRect()
    const page = map.getContainer().closest('.community-page')
    const sheetTop = page?.querySelector('.community-page__sheet')?.getBoundingClientRect().top ?? mapRect.bottom
    const topBarBottom = page?.querySelector('.community-page__topbar')?.getBoundingClientRect().bottom ?? mapRect.top
    const filterBottom = page?.querySelector('.community-map-filters')?.getBoundingClientRect().bottom ?? topBarBottom
    const visibleTop = Math.max(0, Math.max(topBarBottom, filterBottom) - mapRect.top)
    const visibleBottom = Math.min(mapRect.height, sheetTop - mapRect.top)
    const visibleCenter = (visibleTop + Math.max(visibleTop, visibleBottom)) / 2
    map.easeTo({ center: focusTarget.coordinate, offset: [0, visibleCenter - mapRect.height / 2],
      zoom: focusTarget.zoom === undefined ? map.getZoom() : focusTarget.resetZoom
        ? focusTarget.zoom : Math.max(map.getZoom(), focusTarget.zoom),
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 550,
      easing: progress => 1 - (1 - progress) ** 3 })
  }, [map, focusTarget, className])

  useEffect(() => {
    if (!map || !onMapSelect) return
    const select = (event: { lngLat: { lng: number; lat: number } }) => onMapSelect([event.lngLat.lng, event.lngLat.lat])
    map.on('click', select)
    return () => { map.off('click', select) }
  }, [map, onMapSelect])

  const isMainMap = className?.includes('community-page__map--main') ?? false
  const markerGroups = isMainMap ? groupNearbyMarkers(projected) : projected.map(item => [item])
  const mountainMarkers = projected.filter(({ marker }) => marker.kind === 'mountain')
  const displayedGroups = isMainMap ? [...mountainMarkers.map(item => [item]), ...markerGroups] : markerGroups

  const expandCluster = (group: readonly ProjectedMarker[]) => {
    if (!map) return
    if (map.getZoom() >= Math.min(18, map.getMaxZoom() - 0.5)) {
      setClusterChoices(group.map(item => item.marker))
      return
    }
    const center: Coordinate = [
      group.reduce((total, item) => total + item.marker.coordinate[0], 0) / group.length,
      group.reduce((total, item) => total + item.marker.coordinate[1], 0) / group.length,
    ]
    map.easeTo({ center, zoom: Math.min(map.getZoom() + 2, map.getMaxZoom()),
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220 })
  }

  return <div className={['community-map', className].filter(Boolean).join(' ')}>
    <BaseMap key={mapRetry} className="community-map__base" ariaLabel={ariaLabel} center={center} zoom={zoom}
      routes={routes} showNavigationControl={false} onMapReady={onReady} />
    {mapUnavailable && <div className="community-map__fallback" role="status"><span>지도 배경을 불러오지 못했어요. 목록이나 마커로 후기를 볼 수 있어요.</span>
      <button type="button" onClick={() => { setMapUnavailable(false); setMapRetry(current => current + 1) }}>다시 시도</button></div>}
    <div className="community-map__markers" aria-label="지도 항목">
      {displayedGroups.map(group => group.length > 1 ? <div key={group.map(item => item.marker.id).join('|')}
        className="community-map__pin community-map__pin--cluster"
        style={{ left: group.reduce((total, item) => total + item.x, 0) / group.length,
          top: group.reduce((total, item) => total + item.y, 0) / group.length } as CSSProperties}>
        <button type="button" className="community-map__cluster"
          aria-label={`겹친 지도 항목 ${group.length}개 확대 또는 목록 보기`} onClick={() => expandCluster(group)}>{group.length}</button>
      </div> : group.map(({ marker, x, y }) => <div key={marker.id} className={`community-map__pin community-map__pin--${marker.kind}${marker.selected ? ' community-map__pin--selected' : ''}`}
        style={{ left: x, top: y } as CSSProperties}>
        {marker.kind === 'mountain'
          ? <MountainMarker name={marker.name} variant="point" selected={marker.selected} onClick={() => onMarkerSelect?.(marker.id)} />
          : marker.kind === 'spot' && marker.spotType !== 'other'
            ? <SpotMarker kind={marker.spotType ?? 'photo'} label={marker.name} aria-pressed={marker.selected}
                aria-label={`${marker.name} 선택`} onClick={() => onMarkerSelect?.(marker.id)} />
            : <button type="button" className={`community-map__custom-marker community-map__custom-marker--${marker.kind}`}
                aria-label={`${marker.name} 선택`} aria-pressed={marker.selected} onClick={() => onMarkerSelect?.(marker.id)}>
                <span className="community-map__custom-symbol">{marker.shortLabel ?? <Icon name="Pin" size={18} />}</span>
                {marker.kind !== 'point' && marker.kind !== 'segment' && <span className="community-map__custom-label">{marker.label ?? marker.name}</span>}
              </button>}
      </div>))}
    </div>
    {clusterChoices.length > 0 && <div className="community-map__cluster-choices" role="dialog" aria-label="겹친 지도 항목 선택">
      <button type="button" className="community-map__cluster-close" onClick={() => setClusterChoices([])} aria-label="목록 닫기">×</button>
      <strong>이 위치의 항목</strong>{clusterChoices.map(marker => <button type="button" key={marker.id} onClick={() => { onMarkerSelect?.(marker.id); setClusterChoices([]) }}>{marker.name}</button>)}
    </div>}
    {children}
  </div>
}
