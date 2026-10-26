import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../../../components/common/Button'
import { Field } from '../../../components/common/Field'
import { Icon } from '../../../components/common/Icon'
import { SpotTypeSelector } from '../../../components/review/SpotTypeSelector'
import { spotTypeOptions } from '../../../constants/community'
import type { CommunitySpot, Coordinate, PendingPhoto, SpotType, SpotVote } from '../../../types/community'
import { DUPLICATE_RADIUS_METERS, isSpotHidden, nearbySpotCandidates } from '../../../utils/community'
import { CommunityMap, type CommunityMapMarker, type CommunityMapRoute } from './CommunityMap'
import { PhotoField } from './PhotoField'

type Props = {
  spots: readonly CommunitySpot[]
  votes: Record<string, SpotVote>
  mountainId: string
  mountainCenter: Coordinate
  terrainMountainId?: string
  routeCoordinates?: Coordinate[]
  mode: 'active' | 'postHike'
  recentCourses: readonly SpotRegistrationCourse[]
  selectedHikeId?: string
  onCourseSelect: (hikeRecordId: string) => void
  onError: (message: string) => void
  onCreate: (spot: Omit<CommunitySpot, 'id' | 'targetType' | 'baselinePhotos' | 'baselineReviews' | 'photos'>, photos: PendingPhoto[], distinct: boolean) => Promise<void>
  onUseExisting: (spot: CommunitySpot, photos: PendingPhoto[]) => void
}

export type SpotRegistrationCourse = {
  hikeRecordId: string
  courseId: string
  name: string
  finishedAt: string
  color: string
  coordinates: Coordinate[]
}

type LocationState = 'idle' | 'loading' | 'ready' | 'unavailable'

export function SpotRegistration({ spots, votes, mountainId, mountainCenter, terrainMountainId, routeCoordinates, mode,
  recentCourses, selectedHikeId, onCourseSelect, onError, onCreate, onUseExisting }: Props) {
  const [coordinate, setCoordinate] = useState<Coordinate | null>(null)
  const [locationState, setLocationState] = useState<LocationState>('idle')
  const [locationFocus, setLocationFocus] = useState<{ coordinate: Coordinate; request: number; zoom: number; resetZoom: boolean } | null>(null)
  const [type, setType] = useState<SpotType | undefined>()
  const [name, setName] = useState('')
  const [photos, setPhotos] = useState<PendingPhoto[]>([])
  const [distinct, setDistinct] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [creating, setCreating] = useState(false)
  const mountainSpots = useMemo(() => spots.filter(spot => spot.mountainId === mountainId), [spots, mountainId])
  const candidates = useMemo(() => coordinate && type ? nearbySpotCandidates(mountainSpots, coordinate, type, votes) : [], [mountainSpots, coordinate, type, votes])
  const markers: CommunityMapMarker[] = [
    ...mountainSpots.filter(spot => !isSpotHidden(votes[spot.id])).map(spot => ({ id: spot.id, name: spot.name, kind: 'spot' as const, coordinate: spot.coordinate, spotType: spot.type })),
    ...(coordinate ? [{ id: 'new-position', name: '선택한 위치', kind: 'point' as const, coordinate, shortLabel: '✓' }] : []),
  ]
  const recentRoutes = useMemo<CommunityMapRoute[]>(() => recentCourses.map(course => ({
    id: course.hikeRecordId,
    color: course.color,
    coordinates: course.coordinates,
    selected: course.hikeRecordId === selectedHikeId,
  })), [recentCourses, selectedHikeId])
  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationState('unavailable')
      return
    }
    setLocationState('loading')
    navigator.geolocation.getCurrentPosition(position => {
      const current: Coordinate = [position.coords.longitude, position.coords.latitude]
      setCoordinate(current)
      setDistinct(false)
      setLocationFocus(previous => ({ coordinate: current, request: (previous?.request ?? 0) + 1, zoom: 16, resetZoom: true }))
      setLocationState('ready')
    }, () => setLocationState('unavailable'), { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 })
  }, [])

  useEffect(() => {
    if (mode !== 'active') return
    const frame = window.requestAnimationFrame(locate)
    return () => window.cancelAnimationFrame(frame)
  }, [locate, mode])

  async function createSpot() {
    setSubmitted(true)
    if (!coordinate || !type || !name.trim()) {
      onError('위치, 스팟 종류, 이름을 모두 입력해 주세요.')
      return
    }
    if (candidates.length && !distinct) {
      onError('근처에 비슷한 스팟이 있어요. 기존 스팟을 선택하거나 다른 장소임을 확인해 주세요.')
      return
    }
    if (creating) return
    setCreating(true)
    try {
      await onCreate({ name: name.trim(), type, coordinate, mountainId, seedQuote: undefined, userCreated: true }, photos, distinct)
    } catch (error) {
      onError(error instanceof Error ? error.message : '스팟을 등록하지 못했습니다.')
    } finally {
      setCreating(false)
    }
  }
  return <div className="community-form-layout community-register">
    <div className="community-form-layout__scroll">
      <h2>새 스팟 등록</h2><p className="community-form-subtitle">지도에서 위치 지정</p>
      {mode === 'postHike' && recentCourses.length > 0 && <fieldset className="community-course-options community-register__courses">
        <legend className="community-field-label">최근에 다녀온 코스</legend>
        {recentCourses.map(course => <label key={course.hikeRecordId} className="community-course-option">
          <input type="radio" name="spot-course" checked={course.hikeRecordId === selectedHikeId}
            onChange={() => onCourseSelect(course.hikeRecordId)} />
          <span className="community-course-option__indicator" aria-hidden="true" />
          <span className="community-course-option__copy"><strong>{course.name}</strong>
            <small>{new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(course.finishedAt))} 완료</small></span>
        </label>)}
      </fieldset>}
      <div className="community-register__map"><CommunityMap markers={markers} mountainId={terrainMountainId} center={mountainCenter} zoom={14}
        className="community-page__map--select" focusTarget={locationFocus ?? undefined}
        showRoute={mode === 'active' ? (routeCoordinates?.length ?? 0) > 1 : recentRoutes.length > 0}
        highlightedRoute={mode === 'active' ? routeCoordinates : undefined}
        highlightedRoutes={mode === 'postHike' ? recentRoutes : undefined}
        fitHighlightedRoute={!locationFocus}
        ariaLabel="새 스팟 위치 지정" onMapSelect={point => { setCoordinate(point); setDistinct(false) }}
        onMarkerSelect={marker => { const found = spots.find(spot => spot.id === marker.id); if (found) onUseExisting(found, photos) }} />
      </div>
      <div className="community-register__location">
        <span>{locationState === 'loading' ? '현재 위치를 확인하고 있어요.'
          : locationState === 'unavailable' && mode === 'active' ? '현재 위치를 받지 못해 등산 중인 코스를 보여드려요.'
            : coordinate ? `선택한 위치 · ${type ? spotTypeOptions.find(option => option.value === type)?.label : '종류를 선택해 주세요'}`
              : '지도를 눌러 위치를 선택해 주세요.'}</span>
        {mode === 'active' && <button type="button" disabled={locationState === 'loading'} onClick={locate}>현재 위치로 이동</button>}
      </div>
      {submitted && !coordinate && <p className="community-field-error" role="alert">지도에서 위치를 선택해 주세요.</p>}
      <span className="community-field-label">스팟 종류</span>
      <SpotTypeSelector options={spotTypeOptions.map(option => ({ ...option, icon: <Icon name={option.icon} size={22} /> }))}
        value={type} onChange={value => { setType(value as SpotType); setDistinct(false) }} />
      {submitted && !type && <p className="community-field-error" role="alert">스팟 종류를 선택해 주세요.</p>}
      <div className="community-register__name"><Field label="스팟 이름" placeholder="예: 백운대 전망 바위" showIcon={false}
        value={name} maxLength={40} onChange={event => setName(event.target.value)}
        state={submitted && !name.trim() ? 'error' : undefined} helper="스팟 이름을 입력해 주세요." /></div>
      <PhotoField photos={photos} onChange={setPhotos} onError={onError} label="사진" />
      {coordinate && type && <section className="community-duplicates" aria-live="polite">
        <h3>주변 중복 스팟 확인</h3>
        {candidates.length ? <><p>같은 유형의 스팟이 {DUPLICATE_RADIUS_METERS}m 이내에 있어요. 같은 장소라면 새로 만들지 않고 기존 스팟에 사진이나 후기를 추가해 주세요.</p>
          {candidates.map(({ spot, meters }) => <div key={spot.id} className="community-duplicate-card">
            <span className="community-duplicate-card__photo">{spot.photos[0] ? <img src={spot.photos[0]} alt={`${spot.name} 사진`} /> : <Icon name="Photo" size={22} aria-label="등록된 사진 없음" />}</span>
            <div><strong>{spot.name}</strong><small>약 {Math.round(meters)}m · {spotTypeOptions.find(option => option.value === spot.type)?.label}</small>
              <small>위치 {spot.coordinate[1].toFixed(5)}, {spot.coordinate[0].toFixed(5)}</small></div>
            <Button size="compact" label="기존 스팟에 추가" onClick={() => onUseExisting(spot, photos)} />
          </div>)}
          <label className="community-register__distinct"><input type="checkbox" checked={distinct} onChange={event => setDistinct(event.target.checked)} />위 후보와 다른 장소예요</label>
        </> : <p>근처에 같은 유형의 스팟이 없어요.</p>}
      </section>}
    </div>
    <div className="community-form-layout__action"><Button fullWidth label={creating ? '등록 중' : '스팟 등록'} disabled={creating} onClick={createSpot} /></div>
  </div>
}
