import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/common/Button'
import { Icon } from '../../components/common/Icon'
import { Chip } from '../../components/common/Chip'
import { BottomNavigation, TopBar, type BottomDestination } from '../../components/layout'
import { BottomSheet, ModalLayer } from '../../components/overlay'
import { EmptyState, Toast } from '../../components/feedback'
import { communityApi, fromSpotType, toSpotType, type CommunityCourseDto, type CommunityEligibilityDto, type CommunityMapSpotDto, type CommunityMountainDto, type CommunityMountainReviewSummaryDto, type CommunityPhotoDto, type CommunityReviewDto, type CommunitySpotDto } from '../../api/community'
import type { CommunityReview, CommunityCourseReviewTarget, CommunitySpotTargetType, Coordinate, ReviewDraft, ReviewKind, SpotType } from '../../types/community'
import type { CompletedHike } from '../../store/hikeSessionStore'
import type { CommunitySpot, SpotVote } from '../../types/community'
import { isSpotHidden } from '../../utils/community'
import { communityCourseColor } from '../../constants/community'
import { SOUTH_KOREA_MAINLAND_CENTER } from '../../constants/map'
import { CommunityMap, type CommunityMapBounds, type CommunityMapMarker } from './components/CommunityMap'
import { bufferMapBounds, coversMapBounds, nearestCoordinate } from './components/communityMapBounds'
import { CommunityPhotoAlbum, CommunityPhotoReview, CommunityPhotoStrip, type CommunityGalleryPhoto } from './components/SpotPhotoGallery'
import { ReviewForm } from './components/ReviewForm'
import { SpotRegistration, type SpotRegistrationCourse } from './components/SpotRegistration'
import { SpotTypeDropdown } from './components/SpotTypeDropdown'
import { useCommunitySheet } from './hooks/useCommunitySheet'
import './community.css'

export type CommunityScreen = 'mountainSelect' | 'map' | 'mountainDetail' | 'spotDetail' | 'courseDetail' | 'mountainReviewList' | 'spotReviewList' | 'courseReviewList' | 'review' | 'spotPicker' | 'newSpot' | 'photoAlbum' | 'photoReview'
type MapCategory = 'all' | ReviewKind

export type CommunityPageProps = {
  initialScreen?: CommunityScreen
  initialMountainId?: string
  initialSpotId?: string
  initialCourseId?: string
  spotRegistrationMode?: 'active' | 'postHike'
  onSpotRegistered?: () => void
  readOnly?: boolean
  onExit?: () => void
  onNavigateOutside?: (destination: BottomDestination) => void
}

const reviewRuleMessage = '산행 완료 후 24시간 이내에만 후기 작성 가능'
const MOUNTAIN_SELECT_CENTER: Coordinate = SOUTH_KOREA_MAINLAND_CENTER
const MOUNTAIN_SELECT_ZOOM = 6.1
const MOUNTAIN_SELECT_FOCUS_ZOOM = 9.5
const MAIN_MAP_ZOOM = 14
const CATEGORY_MAP_ZOOM: Record<MapCategory, number> = { all: 12.5, mountain: MAIN_MAP_ZOOM, spot: 14.5, course: 11.99 }
const MOUNTAIN_DETAIL_ZOOM = CATEGORY_MAP_ZOOM.mountain
const MAP_SPOT_CACHE_MS = 5 * 60_000
type CommunityMountain = { id: string; externalId?: string; name: string; position: Coordinate }

const legacyMountainNames: Record<string, string> = {
  bukhansan: '북한산', dobongsan: '도봉산', gwanaksan: '관악산', seoraksan: '설악산', jirisan: '지리산',
}

function courseCenter(course: CommunityCourseReviewTarget): Coordinate {
  return course.coordinates[Math.floor(course.coordinates.length / 2)] ?? MOUNTAIN_SELECT_CENTER
}

function blankDraft(kind: ReviewKind, targetId: string): ReviewDraft {
  return { kind, targetId, content: '', photos: [], rating: 0 }
}

function toMountain(mountain: CommunityMountainDto): CommunityMountain {
  return { id: String(mountain.mountainId), externalId: mountain.externalId ?? undefined,
    name: mountain.name, position: [mountain.longitude, mountain.latitude] }
}

function toCourse(course: CommunityCourseDto): CommunityCourseReviewTarget {
  return { id: String(course.courseId), externalId: course.externalId ?? undefined, mountainId: String(course.mountainId),
    name: course.name, coordinates: course.coordinates.map(point => [point.longitude, point.latitude]),
    distanceKm: Number(course.distanceKm.toFixed(1)), baselinePhotos: course.photoCount, baselineReviews: course.reviewCount,
    representativePhotoUrl: course.representativePhotoUrl ?? undefined, seedQuote: '' }
}

function toEligibleHikes(eligibility: CommunityEligibilityDto, courses: readonly CommunityCourseReviewTarget[], mountainId: string): CompletedHike[] {
  return [...eligibility.hikes]
    .sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt))
    .map(hike => ({
      id: String(hike.hikeRecordId), courseId: String(hike.courseId), mountainId,
      courseName: hike.courseName, distanceKm: courses.find(course => course.id === String(hike.courseId))?.distanceKm ?? 0,
      finishedAt: hike.endedAt,
    }))
}

function toSpot(spot: CommunitySpotDto): CommunitySpot {
  return { id: `${spot.targetType}:${spot.targetId}`, targetId: String(spot.targetId), targetType: spot.targetType, name: spot.name, type: fromSpotType(spot.type),
    coordinate: [spot.longitude, spot.latitude], mountainId: String(spot.mountainId), baselinePhotos: spot.photoCount,
    baselineReviews: spot.reviewCount, photos: spot.representativePhotoUrl ? [spot.representativePhotoUrl] : [] }
}

function toMapSpot(spot: CommunityMapSpotDto): CommunitySpot {
  return { id: `${spot.targetType}:${spot.targetId}`, targetId: String(spot.targetId), targetType: spot.targetType,
    name: spot.name, type: fromSpotType(spot.type), coordinate: [spot.longitude, spot.latitude],
    mountainId: String(spot.mountainId), baselinePhotos: 0, baselineReviews: 0, photos: [] }
}

function toReview(review: CommunityReviewDto): CommunityReview {
  return { id: String(review.reviewId), kind: review.kind.toLowerCase() as ReviewKind, targetId: String(review.targetId),
    content: review.content, photos: review.photoUrls, rating: review.rating ?? undefined,
    author: review.author, createdAt: review.createdAt }
}

function toGalleryPhoto(photo: CommunityPhotoDto): CommunityGalleryPhoto {
  return { id: `photo:${photo.photoId}`, src: photo.url, author: photo.author,
    exampleText: photo.reviewContent ?? undefined, exampleRating: photo.reviewRating ?? undefined,
    exampleDate: new Date(photo.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }),
    source: photo.reviewContent == null ? 'spot' : 'review' }
}

function fetchPhotos(kind: ReviewKind, mountainId: string, spotTargetType: CommunitySpotTargetType | undefined, spotTargetId: string | undefined, courseId: string, signal: AbortSignal, offset: number) {
  if (kind === 'mountain') return communityApi.mountainPhotos(mountainId, signal, 11, offset)
  if (kind === 'course') return communityApi.coursePhotos(courseId, signal, 11, offset)
  if (!spotTargetType || !spotTargetId) throw new Error('스팟 정보를 찾지 못했습니다.')
  return communityApi.spotPhotos(mountainId, spotTargetType, spotTargetId, signal, 11, offset)
}

function toVote(spot: CommunityMapSpotDto): SpotVote {
  return { yes: spot.yesVotes, no: spot.noVotes, viewer: normalizeVote(spot.viewerVote) }
}

function normalizeVote(vote: 'YES' | 'NO' | null): SpotVote['viewer'] {
  return vote ? vote.toLowerCase() as SpotVote['viewer'] : null
}

function ReviewQuotes({ reviews, scrollable = false, limit, showRating = false, photos, onPhotoOpen }: {
  reviews: readonly CommunityReview[]
  scrollable?: boolean
  limit?: number
  showRating?: boolean
  photos?: readonly CommunityGalleryPhoto[]
  onPhotoOpen?: (id: string) => void
}) {
  if (reviews.length === 0) return <EmptyState showIcon={false} title="아직 등록된 후기가 없어요." description="" className="community-empty" />
  const shownReviews = reviews.slice(0, limit)
  const thumbnail = (photo: CommunityGalleryPhoto | undefined, label: string) => photo?.src && onPhotoOpen
    ? <button type="button" className="community-quote__photo" aria-label={`${label} 사진 크게 보기`} onClick={() => onPhotoOpen(photo.id)}>
      <img src={photo.src} alt="" loading="lazy" /></button> : null
  return <div className={`community-quote-list${scrollable ? ' community-quote-list--scrollable' : ''}`} role={scrollable ? 'region' : undefined}
    aria-label={scrollable ? '산 후기 목록' : undefined} tabIndex={scrollable ? 0 : undefined}>
    {shownReviews.map(review => <div key={review.id} className="community-quote"><div className="community-quote__row">
      {thumbnail(photos?.find(photo => photo.review?.id === review.id), '내 후기')}
      <div className="community-quote__text">{showRating
        ? <span className="community-quote__meta community-quote__meta--mountain"><span>{review.author ?? '나'}</span>{review.rating != null && <strong>★ {review.rating.toFixed(1)}</strong>}<time dateTime={review.createdAt}>{new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(review.createdAt))}</time></span>
        : <span>{review.author ?? '나'} · <time dateTime={review.createdAt}>{new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(review.createdAt))}</time></span>}
        <p>{review.content}</p>
        </div>
    </div></div>)}
  </div>
}

function EmptyReviewPreview({ mountainName, kind, message }: { mountainName: string; kind: 'spot' | 'course'; message?: string }) {
  return <div className="af-review-preview community-empty-preview" role="status">
    <span className="af-review-preview__icon" aria-hidden="true"><Icon name={kind === 'spot' ? 'Photo' : 'Pin'} size={24} color="currentColor" /></span>
    <span className="af-review-preview__copy"><span className="af-review-preview__mountain">{mountainName}</span>
      <span className="af-review-preview__rating">{message ?? (kind === 'spot' ? '표시할 스팟이 없어요' : '표시할 코스가 없어요')}</span></span>
  </div>
}

function CommunityRowsSkeleton({ count = 3 }: { count?: number }) {
  return <div className="community-rows-skeleton" role="status" aria-label="목록을 불러오는 중">
    {Array.from({ length: count }, (_, index) => <div key={index} className="community-rows-skeleton__row" aria-hidden="true">
      <span className="community-rows-skeleton__photo" /><span className="community-rows-skeleton__copy"><span /><span /></span>
    </div>)}
  </div>
}

function CommunityPhotoSkeleton() {
  return <div className="community-photo-skeleton" role="status" aria-label="사진을 불러오는 중">
    <span className="community-photo-skeleton__heading" aria-hidden="true" />
    <div className="community-photo-skeleton__strip" aria-hidden="true"><span /><span /></div>
  </div>
}

function ReviewEligibilityInfo() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    const closeOutsideClick = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('click', closeOutsideClick)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('click', closeOutsideClick) }
  }, [open])
  return <span ref={rootRef} className="community-review-info" data-open={open}>
    <button type="button" className="community-review-info__button" aria-label="후기 작성 조건" aria-expanded={open}
      aria-describedby="community-review-rule" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}
      onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); event.currentTarget.blur() } }}>
      <span aria-hidden="true">!</span>
    </button>
    <span id="community-review-rule" role="tooltip" className="community-review-info__tooltip">{reviewRuleMessage}</span>
  </span>
}

export function CommunityPage({ initialScreen = 'mountainSelect', initialMountainId, initialSpotId, initialCourseId,
  spotRegistrationMode = 'postHike', onSpotRegistered, readOnly = false, onExit, onNavigateOutside }: CommunityPageProps) {
  const [screens, setScreens] = useState<CommunityScreen[]>([initialScreen])
  const screen = screens.at(-1)!
  const isDetail = screen === 'mountainDetail' || screen === 'spotDetail' || screen === 'courseDetail'
  const [mountains, setMountains] = useState<CommunityMountain[]>([])
  const [courses, setCourses] = useState<CommunityCourseReviewTarget[]>([])
  const [communityLoading, setCommunityLoading] = useState(false)
  const [spots, setSpots] = useState<CommunitySpot[]>([])
  const [mapSpots, setMapSpots] = useState<CommunitySpot[]>([])
  const [listedSpots, setListedSpots] = useState<CommunitySpot[]>([])
  const [spotListCursor, setSpotListCursor] = useState<string | null>(null)
  const [spotListHasNext, setSpotListHasNext] = useState(false)
  const [spotListLoading, setSpotListLoading] = useState(false)
  const [spotListError, setSpotListError] = useState(false)
  const [spotListFirstRetry, setSpotListFirstRetry] = useState(0)
  const [spotListNextRetry, setSpotListNextRetry] = useState(0)
  const spotListBusy = useRef(false)
  const spotListEnd = useRef<HTMLDivElement>(null)
  const shownSpotListKey = useRef('')
  const [reviewList, setReviewList] = useState<{ key: string; items: CommunityReview[]; hasNext: boolean; loading: boolean; error: boolean }>({ key: '', items: [], hasNext: false, loading: false, error: false })
  const [reviewListRetry, setReviewListRetry] = useState(0)
  const reviewListBusy = useRef(false)
  const reviewListEnd = useRef<HTMLDivElement>(null)
  const [photoPage, setPhotoPage] = useState<{ key: string; items: CommunityGalleryPhoto[]; hasNext: boolean; loading: boolean; error: boolean }>({ key: '', items: [], hasNext: false, loading: false, error: false })
  const [photoPageRetry, setPhotoPageRetry] = useState(0)
  const photoPageBusy = useRef(false)
  const photoAlbumEnd = useRef<HTMLDivElement>(null)
  const photoStripEnd = useRef<HTMLButtonElement>(null)
  const [mapBounds, setMapBounds] = useState<CommunityMapBounds | null>(null)
  const mapSpotCache = useRef(new Map<string, { bounds: CommunityMapBounds; spots: CommunityMapSpotDto[]; fetchedAt: number }>())
  const shownMapSpotKey = useRef('')
  const [reviews, setReviews] = useState<CommunityReview[]>([])
  const [mountainSummary, setMountainSummary] = useState<CommunityMountainReviewSummaryDto | null>(null)
  const [votes, setVotes] = useState<Record<string, SpotVote>>({})
  const [eligibleCourses, setEligibleCourses] = useState<CompletedHike[]>([])
  const [reviewEligibleCourses, setReviewEligibleCourses] = useState<CompletedHike[]>([])
  const [spotHikeId, setSpotHikeId] = useState('')
  const [mountainId, setMountainId] = useState('')
  const [mountainFocus, setMountainFocus] = useState<{ coordinate: Coordinate; request: number; zoom: number; resetZoom: boolean } | null>(null)
  const [mapCategory, setMapCategory] = useState<MapCategory>('all')
  const [mapFocusCategory, setMapFocusCategory] = useState<MapCategory>('all')
  const [categoryFocusRequest, setCategoryFocusRequest] = useState(1)
  const categoryFocusFrame = useRef<number | null>(null)
  const categoryFocusTimer = useRef<number | null>(null)
  const [spotFocusCenter, setSpotFocusCenter] = useState<Coordinate | null>(null)
  const [spotTypeFilter, setSpotTypeFilter] = useState<SpotType | 'all'>('all')
  const inlineMountainDetail = screen === 'map' && mapCategory === 'mountain'
  const [reviewKindPickerOpen, setReviewKindPickerOpen] = useState(false)
  const mapScrollTop = useRef(0)
  const reviewPickerRef = useRef<HTMLElement>(null)
  const [detailSpotId, setDetailSpotId] = useState(initialSpotId ?? '')
  const [detailCourseId, setDetailCourseId] = useState(initialCourseId ?? '')
  const [galleryPhotoId, setGalleryPhotoId] = useState<string | null>(null)
  const [galleryKind, setGalleryKind] = useState<ReviewKind>('spot')
  const [lightboxPhoto, setLightboxPhoto] = useState<CommunityGalleryPhoto | null>(null)
  const [detailSpotFocus, setDetailSpotFocus] = useState<{ coordinate: Coordinate; request: number; zoom: number } | null>(null)
  const [draft, setDraft] = useState<ReviewDraft>(() => blankDraft('mountain', initialMountainId ?? ''))
  const [pickerSpotId, setPickerSpotId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const toastId = useRef(0)
  const notify = useCallback((message: string) => {
    const id = ++toastId.current
    setToast({ id, message })
    window.setTimeout(() => setToast(current => current?.id === id ? null : current), 2800)
  }, [])
  const detailSpotForHeight = spots.find(spot => spot.id === detailSpotId)
  const compactEmptySpot = screen === 'spotDetail' && !!detailSpotForHeight && !isSpotHidden(votes[detailSpotId])
    && detailSpotForHeight.baselinePhotos === 0 && detailSpotForHeight.photos.length === 0
    && detailSpotForHeight.baselineReviews === 0
    && !reviews.some(review => review.kind === 'spot' && review.targetId === detailSpotForHeight.id)
  const { rootRef, style: sheetStyle, peek: sheetPeek, level: sheetLevel, reset: resetSheet, handleProps } = useCommunitySheet(isDetail || inlineMountainDetail, screen === 'map' && !inlineMountainDetail, compactEmptySpot)
  useEffect(() => {
    const controller = new AbortController()
    void communityApi.mountains(controller.signal).then(result => {
      const loaded = result.map(toMountain)
      setMountains(loaded)
      const requestedName = initialMountainId ? legacyMountainNames[initialMountainId] : undefined
      const selected = initialMountainId
        ? loaded.find(item => item.id === initialMountainId || item.externalId === initialMountainId || item.name === requestedName)
        : undefined
      if (selected) setMountainId(selected.id)
    }).catch(error => {
      if (!controller.signal.aborted) notify(error instanceof Error ? error.message : '산 정보를 불러오지 못했습니다.')
    })
    return () => controller.abort()
  }, [initialMountainId, notify])

  useEffect(() => {
    if (!mountainId) return
    const controller = new AbortController()
    setCommunityLoading(true)
    setCourses([])
    setSpots([])
    setMapSpots([])
    setReviews([])
    setVotes({})
    setMountainSummary(null)
    void Promise.all([
      communityApi.courses(mountainId, controller.signal),
      communityApi.mountainPreview(mountainId, controller.signal),
      communityApi.eligibleHikes(mountainId, controller.signal),
    ]).then(([courseResult, mountainPreview, eligibility]) => {
      const loadedCourses = courseResult.map(toCourse)
      if (controller.signal.aborted) return
      setCourses(loadedCourses)
      setMountainSummary(mountainPreview.summary)
      setReviews(mountainPreview.reviews.map(toReview))
      setPhotoPage({ key: `mountain:${mountainId}`, items: mountainPreview.photos.slice(0, 10).map(toGalleryPhoto),
        hasNext: mountainPreview.photos.length > 10, loading: false, error: false })
      const eligibleHikes = toEligibleHikes(eligibility, loadedCourses, mountainId)
      setEligibleCourses(eligibleHikes)
      setSpotHikeId(current => eligibleHikes.some(hike => hike.id === current) ? current : eligibleHikes[0]?.id ?? '')
      setDraft(current => current.kind === 'mountain' && !current.completedHikeId && eligibleHikes[0]
        ? { ...current, targetId: mountainId, completedHikeId: eligibleHikes[0].id }
        : current)
      const requestedCourse = loadedCourses.find(course => course.id === initialCourseId || course.externalId === initialCourseId)
      const completedCourse = initialScreen === 'newSpot'
        ? loadedCourses.find(course => course.id === eligibleHikes[0]?.courseId)
        : undefined
      setDetailCourseId(current => requestedCourse?.id ?? completedCourse?.id
        ?? (loadedCourses.some(course => course.id === current) ? current : loadedCourses[0]?.id ?? ''))
    }).catch(error => {
      if (!controller.signal.aborted) notify(error instanceof Error ? error.message : '커뮤니티 정보를 불러오지 못했습니다.')
    }).finally(() => {
      if (!controller.signal.aborted) setCommunityLoading(false)
    })
    return () => controller.abort()
  }, [initialCourseId, initialScreen, mountainId, notify])

  const listSpot = spots.find(item => item.id === detailSpotId)
  const reviewListKey = screen === 'mountainReviewList' ? `mountain:${mountainId}`
    : screen === 'spotReviewList' && listSpot ? `spot:${mountainId}:${listSpot.id}`
      : screen === 'courseReviewList' ? `course:${detailCourseId}` : ''
  useEffect(() => {
    if (!reviewListKey || !mountainId) return
    const controller = new AbortController()
    const kind: ReviewKind = screen === 'mountainReviewList' ? 'mountain' : screen === 'spotReviewList' ? 'spot' : 'course'
    const targetId = kind === 'mountain' ? mountainId : kind === 'spot' ? detailSpotId : detailCourseId
    const request = kind === 'mountain' ? communityApi.mountainReviews(mountainId, controller.signal, 21)
      : kind === 'spot' ? communityApi.spotReviews(mountainId, listSpot!.targetType, listSpot!.targetId, controller.signal, 21)
        : communityApi.courseReviews(detailCourseId, controller.signal, 21)
    reviewListBusy.current = true
    setReviewList({ key: reviewListKey, items: [], hasNext: false, loading: true, error: false })
    void request.then(result => {
      if (!controller.signal.aborted) setReviewList({ key: reviewListKey, items: result.slice(0, 20).map(review => ({ ...toReview(review), targetId })),
        hasNext: result.length > 20, loading: false, error: false })
    }).catch(error => {
      if (!controller.signal.aborted) { setReviewList({ key: reviewListKey, items: [], hasNext: false, loading: false, error: true }); notify(error instanceof Error ? error.message : '후기를 불러오지 못했습니다.') }
    }).finally(() => { if (!controller.signal.aborted) reviewListBusy.current = false })
    return () => controller.abort()
  }, [detailCourseId, detailSpotId, listSpot?.targetId, listSpot?.targetType, mountainId, notify, reviewListKey, reviewListRetry, screen])

  useEffect(() => {
    if (!reviewListKey || reviewList.key !== reviewListKey || !reviewList.hasNext || reviewList.error) return
    const end = reviewListEnd.current
    if (!end) return
    const controller = new AbortController()
    const observer = new IntersectionObserver(entries => {
      if (!entries[0]?.isIntersecting || reviewListBusy.current) return
      reviewListBusy.current = true
      const kind: ReviewKind = screen === 'mountainReviewList' ? 'mountain' : screen === 'spotReviewList' ? 'spot' : 'course'
      const targetId = kind === 'mountain' ? mountainId : kind === 'spot' ? detailSpotId : detailCourseId
      const offset = reviewList.items.length
      const request = kind === 'mountain' ? communityApi.mountainReviews(mountainId, controller.signal, 21, offset)
        : kind === 'spot' ? communityApi.spotReviews(mountainId, listSpot!.targetType, listSpot!.targetId, controller.signal, 21, offset)
          : communityApi.courseReviews(detailCourseId, controller.signal, 21, offset)
      setReviewList(current => ({ ...current, loading: true }))
      void request.then(result => {
        if (controller.signal.aborted) return
        setReviewList(current => ({ ...current, items: [...current.items, ...result.slice(0, 20).map(review => ({ ...toReview(review), targetId }))],
          hasNext: result.length > 20, loading: false, error: false }))
      }).catch(error => {
        if (!controller.signal.aborted) { setReviewList(current => ({ ...current, loading: false, error: true })); notify(error instanceof Error ? error.message : '후기를 더 불러오지 못했습니다.') }
      }).finally(() => { if (!controller.signal.aborted) reviewListBusy.current = false })
    }, { rootMargin: '160px' })
    observer.observe(end)
    return () => { observer.disconnect(); controller.abort() }
  }, [detailCourseId, detailSpotId, listSpot?.targetId, listSpot?.targetType, mountainId, notify, reviewList.error, reviewList.hasNext, reviewList.items.length, reviewList.key, reviewListKey, screen])

  const reportMapBounds = useCallback((bounds: CommunityMapBounds) => {
    setMapBounds(current => current && current.west === bounds.west && current.south === bounds.south
      && current.east === bounds.east && current.north === bounds.north ? current : bounds)
  }, [])

  useEffect(() => {
    if (!mountainId || !mapBounds || !['map', 'spotDetail', 'spotPicker', 'newSpot'].includes(screen)) return
    const controller = new AbortController()
    const type = screen === 'map' && mapCategory === 'spot' && spotTypeFilter !== 'all'
      ? toSpotType(spotTypeFilter) : undefined
    const cacheKey = `${mountainId}:${type ?? 'all'}`
    const cached = mapSpotCache.current.get(cacheKey)
    if (cached && Date.now() - cached.fetchedAt < MAP_SPOT_CACHE_MS && coversMapBounds(cached.bounds, mapBounds)) {
      if (shownMapSpotKey.current !== cacheKey) {
        setMapSpots(cached.spots.map(toMapSpot))
        setVotes(current => ({ ...Object.fromEntries(cached.spots.map(spot => [`${spot.targetType}:${spot.targetId}`, toVote(spot)])), ...current }))
        shownMapSpotKey.current = cacheKey
      }
      return
    }
    if (shownMapSpotKey.current !== cacheKey) {
      setMapSpots([])
      shownMapSpotKey.current = cacheKey
    }
    const queryBounds = bufferMapBounds(mapBounds)
    void communityApi.spots(mountainId, queryBounds, controller.signal, type).then(result => {
      if (controller.signal.aborted) return
      mapSpotCache.current.set(cacheKey, { bounds: queryBounds, spots: result, fetchedAt: Date.now() })
      const loaded = result.map(toMapSpot)
      setMapSpots(loaded)
      setSpots(current => {
        const merged = new Map(current.map(spot => [spot.id, spot]))
        loaded.forEach(spot => { if (!merged.has(spot.id)) merged.set(spot.id, spot) })
        return [...merged.values()]
      })
      setVotes(current => ({ ...current, ...Object.fromEntries(result.map(spot => [`${spot.targetType}:${spot.targetId}`, toVote(spot)])) }))
    }).catch(error => {
      if (!controller.signal.aborted) notify(error instanceof Error ? error.message : '주변 스팟을 불러오지 못했습니다.')
    })
    return () => controller.abort()
  }, [mapBounds, mapCategory, mountainId, notify, screen, spotTypeFilter])

  const listType = mapCategory === 'spot' && spotTypeFilter !== 'all' ? toSpotType(spotTypeFilter) : undefined
  useEffect(() => {
    if (!mountainId || screen !== 'map' || (mapCategory !== 'all' && mapCategory !== 'spot')) return
    const controller = new AbortController()
    const spotListKey = `${mountainId}:${listType ?? 'all'}`
    const keepCurrentList = shownSpotListKey.current === spotListKey
    shownSpotListKey.current = spotListKey
    spotListBusy.current = true
    setSpotListLoading(true)
    if (!keepCurrentList) {
      setListedSpots([])
      setSpotListCursor(null)
      setSpotListHasNext(false)
    }
    setSpotListError(false)
    void communityApi.spotList(mountainId, controller.signal, listType).then(page => {
      if (controller.signal.aborted) return
      const loaded = page.items.map(toSpot)
      setListedSpots(current => {
        if (!keepCurrentList) return loaded
        const loadedIds = new Set(loaded.map(spot => spot.id))
        return [...loaded, ...current.filter(spot => !loadedIds.has(spot.id))]
      })
      setSpots(current => {
        const merged = new Map(current.map(spot => [spot.id, spot]))
        loaded.forEach(spot => merged.set(spot.id, spot))
        return [...merged.values()]
      })
      setSpotListCursor(page.nextCursor)
      setSpotListHasNext(page.hasNext)
    }).catch(error => {
      if (!controller.signal.aborted) { setSpotListError(true); notify(error instanceof Error ? error.message : '스팟 목록을 불러오지 못했습니다.') }
    }).finally(() => {
      if (!controller.signal.aborted) { spotListBusy.current = false; setSpotListLoading(false) }
    })
    return () => controller.abort()
  }, [listType, mapCategory, mountainId, notify, screen, spotListFirstRetry])

  useEffect(() => {
    if (screen !== 'map' || mapCategory !== 'spot' || !spotListHasNext || !spotListCursor) return
    const root = rootRef.current?.querySelector<HTMLElement>('.community-page__sheet--map .af-bottom-sheet__content')
    const end = spotListEnd.current
    if (!root || !end) return
    const controller = new AbortController()
    const observer = new IntersectionObserver(entries => {
      if (!entries[0]?.isIntersecting || spotListBusy.current) return
      spotListBusy.current = true
      setSpotListLoading(true)
      setSpotListError(false)
      void communityApi.spotList(mountainId, controller.signal, listType, spotListCursor).then(page => {
        if (controller.signal.aborted) return
        const loaded = page.items.map(toSpot)
        setListedSpots(current => {
          const merged = new Map(current.map(spot => [spot.id, spot]))
          loaded.forEach(spot => merged.set(spot.id, spot))
          return [...merged.values()]
        })
        setSpots(current => {
          const merged = new Map(current.map(spot => [spot.id, spot]))
          loaded.forEach(spot => merged.set(spot.id, spot))
          return [...merged.values()]
        })
        setSpotListCursor(page.nextCursor)
        setSpotListHasNext(page.hasNext)
      }).catch(error => {
        if (!controller.signal.aborted) { setSpotListError(true); notify(error instanceof Error ? error.message : '스팟 목록을 더 불러오지 못했습니다.') }
      }).finally(() => {
        if (!controller.signal.aborted) { spotListBusy.current = false; setSpotListLoading(false) }
      })
    }, { root, rootMargin: '120px' })
    observer.observe(end)
    return () => { observer.disconnect(); controller.abort() }
  }, [listType, mapCategory, mountainId, notify, rootRef, screen, spotListCursor, spotListHasNext, spotListNextRetry])

  useEffect(() => {
    if (!initialSpotId) return
    const match = spots.find(spot => spot.targetId === initialSpotId)
    if (match) setDetailSpotId(current => current === initialSpotId ? match.id : current)
  }, [initialSpotId, spots])

  useEffect(() => {
    if (screen !== 'spotDetail' || !mountainId) return
    const match = /^(FACILITY|USER_SPOT):([1-9]\d*)$/.exec(detailSpotId)
    if (!match) return
    const controller = new AbortController()
    void communityApi.spotDetail(mountainId, match[1] as CommunitySpotDto['targetType'], match[2], controller.signal).then(result => {
      if (controller.signal.aborted) return
      const spot = toSpot(result)
      setSpots(current => {
        const merged = new Map(current.map(item => [item.id, item]))
        merged.set(spot.id, spot)
        return [...merged.values()]
      })
      setVotes(current => ({ ...current, [spot.id]: toVote(result) }))
    }).catch(error => {
      if (!controller.signal.aborted) notify(error instanceof Error ? error.message : '스팟 상세를 불러오지 못했습니다.')
    })
    return () => controller.abort()
  }, [detailSpotId, mountainId, notify, screen])

  useLayoutEffect(() => {
    if (screen !== 'map') return
    const content = rootRef.current?.querySelector<HTMLElement>('.community-page__sheet--map .af-bottom-sheet__content')
    if (!content) return
    content.scrollTop = mapScrollTop.current
    const saveScroll = () => { mapScrollTop.current = content.scrollTop }
    content.addEventListener('scroll', saveScroll, { passive: true })
    return () => content.removeEventListener('scroll', saveScroll)
  }, [screen, mapCategory, rootRef])
  useEffect(() => {
    if (!reviewKindPickerOpen) return
    const trigger = document.activeElement as HTMLElement | null
    reviewPickerRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }) }
  }, [reviewKindPickerOpen])
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const heading = rootRef.current?.querySelector<HTMLElement>('.af-top-bar__title')
      heading?.setAttribute('tabindex', '-1')
      heading?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [screen, rootRef])
  const mountain = mountains.find(item => item.id === mountainId)
    ?? { id: '', name: '산', position: MOUNTAIN_SELECT_CENTER }
  const terrainMountainId = mountain.externalId
    ?? Object.entries(legacyMountainNames).find(([, name]) => name === mountain.name)?.[0]
  const selectMountain = (id: string) => {
    const selected = mountains.find(item => item.id === id)
    if (!selected) return
    setMountainId(id)
    setMountainFocus(current => ({ coordinate: selected.position as Coordinate, request: (current?.request ?? 0) + 1,
      zoom: MOUNTAIN_SELECT_FOCUS_ZOOM, resetZoom: true }))
  }
  const visibleSpots = useMemo(() => spots.filter(spot => spot.mountainId === mountainId && !isSpotHidden(votes[spot.id])), [spots, votes, mountainId])
  const visibleMapSpots = useMemo(() => mapSpots.filter(spot => spot.mountainId === mountainId && !isSpotHidden(votes[spot.id])), [mapSpots, votes, mountainId])
  const filteredSpots = useMemo(() => mapCategory === 'spot' && spotTypeFilter !== 'all'
    ? visibleMapSpots.filter(spot => spot.type === spotTypeFilter) : visibleMapSpots, [mapCategory, spotTypeFilter, visibleMapSpots])
  const visibleListedSpots = listedSpots.filter(spot => !isSpotHidden(votes[spot.id]))
  const visibleCourseTargets = useMemo(() => courses.filter(course => course.mountainId === mountainId), [courses, mountainId])
  const allCourseRoutes = useMemo(() => visibleCourseTargets.map(course => ({
    id: course.id, color: communityCourseColor(course.name), coordinates: course.coordinates,
  })), [visibleCourseTargets])
  const showAllCourseRoutes = screen === 'map' || screen === 'mountainDetail' || screen === 'spotDetail'
  const mapFocus = useMemo(() => {
    const mountainCenter = mountain.position as Coordinate
    const coordinate = mapFocusCategory === 'spot' ? spotFocusCenter ?? mountainCenter : mountainCenter
    return { coordinate, request: categoryFocusRequest, zoom: CATEGORY_MAP_ZOOM[mapFocusCategory], resetZoom: true }
  }, [mountain.position, mapFocusCategory, categoryFocusRequest, spotFocusCenter])
  const selectedSpot = spots.find(spot => spot.id === detailSpotId)
  const selectedCourse = useMemo(() => courses.find(course => course.id === detailCourseId && course.mountainId === mountainId)
    ?? visibleCourseTargets[0] ?? { id: '', mountainId, name: '코스', coordinates: [mountain.position],
      distanceKm: 0, baselinePhotos: 0, baselineReviews: 0, seedQuote: '' },
  [courses, detailCourseId, mountainId, mountain.position, visibleCourseTargets])
  const selectedCourseColor = communityCourseColor(selectedCourse.name)
  const spotRegistrationCourses = useMemo<SpotRegistrationCourse[]>(() => eligibleCourses.flatMap(hike => {
    const course = visibleCourseTargets.find(item => item.id === hike.courseId)
    return course ? [{ hikeRecordId: hike.id, courseId: course.id, name: course.name, finishedAt: hike.finishedAt,
      color: communityCourseColor(course.name), coordinates: course.coordinates }] : []
  }), [eligibleCourses, visibleCourseTargets])
  const mountainDetailFocus = useMemo(() => ({ coordinate: mountain.position as Coordinate, request: 1, zoom: MOUNTAIN_DETAIL_ZOOM, resetZoom: true }), [mountain.position])
  const courseDetailFocus = useMemo(() => ({ coordinate: courseCenter(selectedCourse), request: 1 }), [selectedCourse])
  const selectedSpotHidden = selectedSpot ? isSpotHidden(votes[selectedSpot.id]) : false
  useEffect(() => {
    if (screen !== 'spotDetail' || !selectedSpotHidden) return
    const frame = window.requestAnimationFrame(() => {
      const heading = rootRef.current?.querySelector<HTMLElement>('.community-page__sheet .af-empty-state__title')
      heading?.setAttribute('tabindex', '-1')
      heading?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [screen, selectedSpotHidden, rootRef])
  const draftSpot = spots.find(spot => spot.id === draft.targetId)
  const activePhotoKind: ReviewKind | null = screen === 'photoAlbum' || screen === 'photoReview' ? galleryKind
    : screen === 'mountainDetail' || (screen === 'map' && mapCategory === 'mountain') ? 'mountain'
      : screen === 'spotDetail' ? 'spot' : screen === 'courseDetail' ? 'course' : null
  const activePhotoKey = activePhotoKind === 'mountain' ? `mountain:${mountainId}`
    : activePhotoKind === 'spot' && selectedSpot ? `spot:${mountainId}:${selectedSpot.id}`
      : activePhotoKind === 'course' && selectedCourse.id ? `course:${selectedCourse.id}` : ''
  const activeSpotId = selectedSpot?.id
  const activeSpotTargetId = selectedSpot?.targetId
  const activeSpotTargetType = selectedSpot?.targetType
  useEffect(() => {
    if (!activePhotoKind || !activePhotoKey || !mountainId) return
    const controller = new AbortController()
    photoPageBusy.current = true
    setPhotoPage({ key: activePhotoKey, items: [], hasNext: false, loading: true, error: false })
    const request = activePhotoKind === 'mountain' ? communityApi.mountainPreview(mountainId, controller.signal)
      : activePhotoKind === 'course' ? communityApi.coursePreview(selectedCourse.id, controller.signal)
        : activeSpotTargetType && activeSpotTargetId ? communityApi.spotPreview(mountainId, activeSpotTargetType, activeSpotTargetId, controller.signal) : null
    if (!request) return () => controller.abort()
    void request.then(result => {
      if (controller.signal.aborted) return
      const targetId = activePhotoKind === 'mountain' ? mountainId : activePhotoKind === 'course' ? selectedCourse.id : activeSpotId!
      setReviews(current => [
        ...current.filter(review => review.kind !== activePhotoKind || review.targetId !== targetId),
        ...result.reviews.map(review => ({ ...toReview(review), targetId })),
      ])
      if ('summary' in result) setMountainSummary(result.summary as CommunityMountainReviewSummaryDto)
      setPhotoPage({ key: activePhotoKey, items: result.photos.slice(0, 10).map(toGalleryPhoto),
        hasNext: result.photos.length > 10, loading: false, error: false })
    }).catch(error => {
      if (!controller.signal.aborted) { setPhotoPage({ key: activePhotoKey, items: [], hasNext: false, loading: false, error: true }); notify(error instanceof Error ? error.message : '사진과 후기를 불러오지 못했습니다.') }
    }).finally(() => { if (!controller.signal.aborted) photoPageBusy.current = false })
    return () => controller.abort()
  }, [activePhotoKey, activePhotoKind, activeSpotId, activeSpotTargetId, activeSpotTargetType, mountainId, notify, photoPageRetry, selectedCourse.id])
  const currentReviews = (kind: ReviewKind, targetId: string) => reviews.filter(review => review.kind === kind && review.targetId === targetId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const mountainReviews = currentReviews('mountain', mountainId)
  const mountainReviewTotal = mountainSummary?.reviewCount ?? mountainReviews.length
  const mountainRating = mountainSummary?.averageRating ?? null
  const mountainPhotos = mountainReviews.flatMap(review => review.photos)
  const mountainPhotoTotal = mountainSummary?.photoCount ?? mountainPhotos.length
  const reviewEligibilityMessage = '이 산의 완료된 산행이 있어야 하며 완료 후 24시간 안에 작성할 수 있어요.'
  const selectedSpotReviews = selectedSpot ? currentReviews('spot', selectedSpot.id) : []
  const spotGalleryPhotos = selectedSpot && photoPage.key === `spot:${mountainId}:${selectedSpot.id}` ? photoPage.items : []
  const courseReviews = currentReviews('course', selectedCourse.id)
  const mountainGalleryPhotos = photoPage.key === `mountain:${mountainId}` ? photoPage.items : []
  const courseGalleryPhotos = photoPage.key === `course:${selectedCourse.id}` ? photoPage.items : []
  const fullReviews = reviewList.key === reviewListKey ? reviewList.items : []
  const fullReviewPhotos: CommunityGalleryPhoto[] = fullReviews.flatMap(review => review.photos.map((src, index) => ({
    id: `${review.id}-${index}`, src, review, source: 'review' as const,
  })))
  const fullReviewStatus = reviewList.key === reviewListKey && <>
    {(reviewList.loading || reviewList.hasNext) && <div ref={reviewListEnd} role="status">{reviewList.loading ? '후기를 불러오는 중…' : ''}</div>}
    {reviewList.error && <button type="button" className="community-inline-link" onClick={() => {
      if (fullReviews.length === 0) setReviewListRetry(current => current + 1)
      else setReviewList(current => ({ ...current, error: false }))
    }}>후기 목록 다시 불러오기</button>}
  </>
  const galleryPhotos = galleryKind === 'mountain' ? mountainGalleryPhotos : galleryKind === 'course' ? courseGalleryPhotos : spotGalleryPhotos
  const galleryTitle = galleryKind === 'mountain' ? mountain.name : galleryKind === 'course' ? selectedCourse.name : selectedSpot?.name ?? '스팟'
  const selectedGalleryIndex = galleryPhotos.findIndex(photo => photo.id === galleryPhotoId)
  const selectedGalleryPhoto = galleryPhotos[selectedGalleryIndex]
  const photoStatus = photoPage.key === activePhotoKey && <>
    {photoPage.loading && photoPage.items.length === 0 && <CommunityPhotoSkeleton />}
    {photoPage.error && <button type="button" className="community-inline-link" onClick={() => {
      if (photoPage.items.length === 0) setPhotoPageRetry(current => current + 1)
      else setPhotoPage(current => ({ ...current, error: false }))
    }}>사진 다시 불러오기</button>}
  </>
  useEffect(() => {
    if (!activePhotoKind || !activePhotoKey || photoPage.key !== activePhotoKey || !photoPage.hasNext || photoPage.error) return
    const nearEnd = screen === 'photoReview' && selectedGalleryIndex >= 0 && selectedGalleryIndex >= photoPage.items.length - 2
    const end = screen === 'photoAlbum' ? photoAlbumEnd.current : screen === 'mountainDetail' || screen === 'spotDetail'
      || screen === 'courseDetail' || (screen === 'map' && mapCategory === 'mountain') ? photoStripEnd.current : null
    if (!nearEnd && !end) return
    const controller = new AbortController()
    const load = () => {
      if (photoPageBusy.current) return
      photoPageBusy.current = true
      setPhotoPage(current => ({ ...current, loading: true }))
      void fetchPhotos(activePhotoKind, mountainId, selectedSpot?.targetType, selectedSpot?.targetId, selectedCourse.id, controller.signal, photoPage.items.length).then(result => {
        if (!controller.signal.aborted) setPhotoPage(current => ({ ...current, items: [...current.items, ...result.slice(0, 10).map(toGalleryPhoto)],
          hasNext: result.length > 10, loading: false, error: false }))
      }).catch(error => {
        if (!controller.signal.aborted) { setPhotoPage(current => ({ ...current, loading: false, error: true })); notify(error instanceof Error ? error.message : '사진을 더 불러오지 못했습니다.') }
      }).finally(() => { if (!controller.signal.aborted) photoPageBusy.current = false })
    }
    if (nearEnd) { load(); return () => controller.abort() }
    const root = end === photoStripEnd.current ? end?.parentElement : null
    const observer = new IntersectionObserver(entries => { if (entries[0]?.isIntersecting) load() }, { root, rootMargin: '160px' })
    observer.observe(end!)
    return () => { observer.disconnect(); controller.abort() }
  }, [activePhotoKey, activePhotoKind, mapCategory, mountainId, notify, photoPage.error, photoPage.hasNext, photoPage.items.length, photoPage.key, screen, selectedCourse.id, selectedGalleryIndex, selectedSpot?.targetId, selectedSpot?.targetType])
  const move = (next: CommunityScreen) => { setErrors({}); setReviewKindPickerOpen(false); resetSheet(); setScreens(current => [...current, next]) }
  const confirmMountainSelection = () => {
    if (!mountainId) return
    mapScrollTop.current = 0
    setMapCategory('all')
    setMapFocusCategory('all')
    setSpotTypeFilter('all')
    move('map')
  }
  const back = () => {
    setErrors({})
    resetSheet()
    if (screens.length === 1) { onExit?.(); return }
    setScreens(current => current.slice(0, -1))
  }
  const registerReview = (start: () => void) => start()
  const showDetail = (kind: ReviewKind, targetId?: string) => {
    if (screen === 'map') mapScrollTop.current = rootRef.current?.querySelector<HTMLElement>('.community-page__sheet--map .af-bottom-sheet__content')?.scrollTop ?? mapScrollTop.current
    if (kind === 'spot' && targetId) focusSpot(targetId)
    if (kind === 'course' && targetId) setDetailCourseId(targetId)
    move(kind === 'mountain' ? 'mountainDetail' : kind === 'spot' ? 'spotDetail' : 'courseDetail')
  }
  const changeMapCategory = (category: MapCategory) => {
    mapScrollTop.current = 0
    setReviewKindPickerOpen(false)
    resetSheet()
    if (category === 'spot') {
      setSpotFocusCenter(nearestCoordinate(visibleListedSpots.map(spot => spot.coordinate), mountain.position as Coordinate))
    }
    setMapCategory(category)
    if (categoryFocusFrame.current !== null) window.cancelAnimationFrame(categoryFocusFrame.current)
    if (categoryFocusTimer.current !== null) window.clearTimeout(categoryFocusTimer.current)
    categoryFocusTimer.current = window.setTimeout(() => {
      categoryFocusFrame.current = window.requestAnimationFrame(() => {
        setMapFocusCategory(category)
        setCategoryFocusRequest(current => current + 1)
        categoryFocusFrame.current = null
      })
      categoryFocusTimer.current = null
    }, sheetPeek ? 240 : 0)
    const content = rootRef.current?.querySelector<HTMLElement>('.community-page__sheet--map .af-bottom-sheet__content')
    if (content) content.scrollTop = 0
  }
  const changeSpotTypeFilter = (type: SpotType | 'all') => {
    setSpotTypeFilter(type)
    mapScrollTop.current = 0
    const content = rootRef.current?.querySelector<HTMLElement>('.community-page__sheet--map .af-bottom-sheet__content')
    if (content) content.scrollTop = 0
  }
  const openGalleryPhoto = (kind: ReviewKind, id: string) => { setGalleryKind(kind); setGalleryPhotoId(id); move('photoReview') }
  const openGallery = (kind: ReviewKind) => { setGalleryKind(kind); move('photoAlbum') }
  const focusSpot = (id: string) => {
    const spot = spots.find(item => item.id === id)
    if (!spot) return
    setDetailSpotId(id)
    setDetailSpotFocus(current => ({ coordinate: spot.coordinate, request: (current?.request ?? 0) + 1, zoom: 16 }))
  }
  const beginReview = async (kind: ReviewKind, targetId: string) => {
    let targetEligibleHikes = eligibleCourses
    if (targetId) {
      try {
        const targetSpot = kind === 'spot' ? spots.find(spot => spot.id === targetId) : undefined
        const eligibility = kind === 'mountain'
          ? await communityApi.mountainEligibility(mountainId)
          : kind === 'course'
            ? await communityApi.courseEligibility(targetId)
            : targetSpot
              ? await communityApi.spotEligibility(mountainId, targetSpot.targetType, targetSpot.targetId)
              : null
        if (!eligibility) { notify('후기를 남길 대상을 찾지 못했습니다.'); return }
        targetEligibleHikes = toEligibleHikes(eligibility, visibleCourseTargets, mountainId)
      } catch (error) {
        notify(error instanceof Error ? error.message : '후기 작성 조건을 확인하지 못했습니다.')
        return
      }
    }
    if (targetEligibleHikes.length === 0) { notify(reviewEligibilityMessage); return }
    setReviewEligibleCourses(targetEligibleHikes)
    if (kind === 'course') {
      const selected = targetEligibleHikes.find(hike => hike.courseId === targetId) ?? targetEligibleHikes[0]
      if (!selected) { notify(reviewEligibilityMessage); return }
      setDraft({ ...blankDraft(kind, selected.courseId), completedHikeId: selected.id })
    } else setDraft({ ...blankDraft(kind, targetId), completedHikeId: targetEligibleHikes[0].id })
    if (screen === 'spotPicker' && screens.includes('review')) back()
    else move('review')
  }
  const startMapReview = (kind: ReviewKind) => {
    if (kind === 'mountain') beginReview('mountain', mountainId)
    else if (kind === 'spot') { setPickerSpotId(null); setDraft(blankDraft('spot', '')); move('spotPicker') }
    else beginReview('course', '')
  }
  const updateDraft = (patch: Partial<ReviewDraft>) => {
    setDraft(current => ({ ...current, ...patch }))
    setErrors(current => { const next = { ...current }; for (const key of Object.keys(patch)) delete next[key]; return next })
  }
  const submitReview = async () => {
    if (reviewEligibleCourses.length === 0 || submitting) { notify(reviewEligibilityMessage); return }
    const next: Record<string, string> = {}
    if (draft.kind === 'mountain' && draft.rating === 0) next.rating = '평점을 선택해 주세요.'
    if (draft.kind === 'spot' && !spots.some(spot => spot.id === draft.targetId && !isSpotHidden(votes[spot.id]))) next.target = '후기를 남길 스팟을 선택해 주세요.'
    if (draft.kind === 'course' && !reviewEligibleCourses.some(hike => hike.courseId === draft.targetId && hike.id === draft.completedHikeId)) next.target = '후기를 남길 코스를 다시 선택해 주세요.'
    if (!draft.completedHikeId) next.target = '후기를 작성할 수 있는 산행 기록이 없습니다.'
    if (!draft.content.trim()) next.content = '후기 내용을 입력해 주세요.'
    if (Object.keys(next).length) { setErrors(next); notify(Object.values(next)[0]); return }
    const targetSpot = draft.kind === 'spot' ? spots.find(spot => spot.id === draft.targetId) : undefined
    setSubmitting(true)
    try {
      const created = await communityApi.createReview(draft.kind, mountainId, targetSpot?.targetId ?? draft.targetId, targetSpot?.targetType, {
        hikeRecordId: Number(draft.completedHikeId), content: draft.content.trim(),
        rating: draft.kind === 'mountain' ? draft.rating : undefined,
      })
      const photoTarget = draft.kind === 'mountain' ? 'MOUNTAIN_REVIEW'
        : draft.kind === 'course' ? 'COURSE_REVIEW' : 'SPOT_REVIEW'
      const uploaded = await communityApi.uploadPhotos(photoTarget, created.reviewId, draft.photos)
      draft.photos.forEach(photo => URL.revokeObjectURL(photo.previewUrl))
      const saved = { ...toReview(created), targetId: targetSpot?.id ?? String(created.targetId), photos: uploaded.map(photo => photo.url) }
      setReviews(current => [saved, ...current])
      if (draft.kind === 'mountain') setMountainSummary(current => {
        const previousCount = current?.reviewCount ?? 0
        return { reviewCount: previousCount + 1,
          averageRating: ((current?.averageRating ?? 0) * previousCount + draft.rating) / (previousCount + 1),
          photoCount: (current?.photoCount ?? 0) + uploaded.length }
      })
      setErrors({})
      const detail: CommunityScreen = draft.kind === 'mountain' ? 'mountainDetail' : draft.kind === 'spot' ? 'spotDetail' : 'courseDetail'
      if (targetSpot) focusSpot(targetSpot.id)
      if (draft.kind === 'course') setDetailCourseId(draft.targetId)
      resetSheet()
      setScreens(['mountainSelect', 'map', detail])
      notify('후기와 사진을 등록했습니다.')
    } catch (error) {
      notify(error instanceof Error ? error.message : '후기를 등록하지 못했습니다.')
    } finally {
      setSubmitting(false)
    }
  }
  const castVote = async (choice: 'yes' | 'no') => {
    if (!selectedSpot || readOnly) return
    try {
      const currentVote = votes[selectedSpot.id]?.viewer
      const result = currentVote === choice
        ? await communityApi.cancelVote(mountainId, selectedSpot.targetType, selectedSpot.targetId)
        : await communityApi.vote(mountainId, selectedSpot.targetType, selectedSpot.targetId, choice)
      const next: SpotVote = { yes: result.yesVotes, no: result.noVotes,
        viewer: normalizeVote(result.viewerVote) }
      mapSpotCache.current.clear()
      setVotes(current => ({ ...current, [selectedSpot.id]: next }))
      setSpots(current => current.map(spot => spot.id === selectedSpot.id ? { ...spot, status: result.status } : spot))
      notify(result.targetType === 'USER_SPOT' && result.status === 'HIDDEN'
        ? '부정 평가가 3건이 되어 이 스팟을 지도에서 숨겼어요.' : '평가를 반영했어요.')
    } catch (error) {
      notify(error instanceof Error ? error.message : '평가를 반영하지 못했습니다.')
    }
  }
  const mapMarkers: CommunityMapMarker[] = [
    { id: mountain.id, name: mountain.name, coordinate: mountain.position as Coordinate, kind: 'mountain' as const },
    ...(mapCategory === 'all' || mapCategory === 'spot' ? filteredSpots.map(spot => ({ id: spot.id, name: spot.name, coordinate: spot.coordinate, kind: 'spot' as const, spotType: spot.type, targetType: spot.targetType })) : []),
    ...(mapCategory === 'all' || mapCategory === 'course'
      ? visibleCourseTargets.map(course => ({ id: course.id, name: course.name, coordinate: courseCenter(course),
        kind: 'course' as const, color: communityCourseColor(course.name) })) : []),
  ]
  const pickSpotMarkers: CommunityMapMarker[] = visibleSpots.map(spot => ({ id: spot.id, name: spot.name,
    coordinate: spot.coordinate, kind: 'spot', spotType: spot.type, selected: pickerSpotId === spot.id }))
  function handleBottomNavigation(destination: BottomDestination) {
    if (destination === 'community') {
      setScreens(['mountainSelect'])
      setMountainId('')
      setMountainFocus(null)
      setMapCategory('all')
      setMapFocusCategory('all')
      setSpotTypeFilter('all')
      setSpotFocusCenter(null)
      setMapBounds(null)
      setReviewKindPickerOpen(false)
      resetSheet()
      return
    }
    if (onNavigateOutside) onNavigateOutside(destination)
    else notify('다른 탭과의 연결은 별도 라우팅 작업에서 진행합니다.')
  }
  const title = screen === 'mountainSelect' ? '산 선택' : screen === 'map' ? '커뮤니티 지도'
    : screen === 'mountainDetail' ? `${mountain.name} 후기` : screen === 'spotDetail' ? '스팟 상세' : screen === 'mountainReviewList' || screen === 'spotReviewList' || screen === 'courseReviewList' ? '후기 목록'
      : screen === 'courseDetail' ? '코스 상세' : screen === 'review' ? `${draft.kind === 'mountain' ? '산' : draft.kind === 'spot' ? '스팟' : '코스'} 후기 작성`
        : screen === 'spotPicker' ? '스팟 위치 선택'
          : screen === 'photoAlbum' ? '사진첩' : screen === 'photoReview' ? '사진 후기' : '새 스팟 등록'
  const mountainReviewContent = communityLoading
    ? <CommunityRowsSkeleton count={2} />
    : mountainRating === null
    ? <EmptyState showIcon={false} title="아직 등록된 후기가 없어요" description="이 산의 첫 후기를 남겨보세요." className="community-mountain-empty" />
    : <>
      {mountainPhotoTotal > 0 && <div className="community-detail-photos">{mountainGalleryPhotos.length > 0 && <CommunityPhotoStrip kindLabel="산" photos={mountainGalleryPhotos}
        totalCount={mountainPhotoTotal} endRef={photoStripEnd} onViewAll={() => openGallery('mountain')} onOpen={id => openGalleryPhoto('mountain', id)} />}{photoStatus}</div>}
      <div className="community-review-heading"><strong>방문자 후기</strong>
        {mountainReviews.length > 0 &&
          <button type="button" aria-label={`${mountain.name} 후기 전체보기`} onClick={() => move('mountainReviewList')}>전체보기 <Icon name="ChevronRight" size={16} /></button>}
      </div>
      <ReviewQuotes reviews={mountainReviews} limit={3} showRating />
    </>
  const mountainHeaderScore = mountainRating !== null && <span className="community-detail-score">
    <span className="community-detail-score__summary"><span>★ {mountainRating.toFixed(1)}</span><small>후기 {mountainReviewTotal}</small></span>
  </span>
  return <main ref={rootRef} className="community-page" style={sheetStyle} aria-label={title}>
    <TopBar title={title} showLeading={screen !== 'mountainSelect' || Boolean(onExit)} showAction={false} onBack={back} className="community-page__topbar" />

    {screen === 'mountainSelect' && <>
      <CommunityMap className="community-page__map community-page__map--select" showRoute={false} center={MOUNTAIN_SELECT_CENTER} focusTarget={mountainFocus ?? undefined} zoom={MOUNTAIN_SELECT_ZOOM}
        markers={mountains.map(item => ({ id: item.id, name: item.name, kind: 'mountain', coordinate: item.position as Coordinate, selected: mountainId === item.id }))}
        onMarkerSelect={marker => selectMountain(marker.id)} />
      <BottomSheet title="커뮤니티에서 볼 산을 선택해주세요" showClose={false}
        handleProps={handleProps} bodyHidden={sheetPeek}
        className={`community-page__sheet community-page__sheet--select${sheetPeek ? ' community-page__sheet--peek' : ''}`} content={<div className="community-mountain-chips">{mountains.map(item =>
          <Chip key={item.id} label={item.name} selected={mountainId === item.id} onClick={() => selectMountain(item.id)} />)}</div>}
        showFooter footer={<Button fullWidth label="선택 완료" disabled={!mountainId} onClick={confirmMountainSelection} />} />
    </>}

    {(screen === 'map' || isDetail) && <CommunityMap
      className={`community-page__map ${screen === 'map' ? `community-page__map--main${inlineMountainDetail ? ' community-page__map--mountain-focus' : ''}` : `community-page__map--detail community-page__map--detail-${screen === 'mountainDetail' ? 'mountain' : screen === 'spotDetail' ? 'spot' : 'course'}`}`}
      mountainId={terrainMountainId}
      showMountainFlag
      showMountainLabel={screen === 'map' && mapCategory === 'mountain'}
      center={mountain.position as Coordinate}
      zoom={MAIN_MAP_ZOOM}
      focusTarget={screen === 'map' ? mapFocus : screen === 'mountainDetail' ? mountainDetailFocus : screen === 'spotDetail' ? detailSpotFocus ?? undefined
        : screen === 'courseDetail' ? courseDetailFocus : undefined}
      showRoute={showAllCourseRoutes ? allCourseRoutes.some(route => route.coordinates.length > 1)
        : screen === 'courseDetail' && selectedCourse.coordinates.length > 1}
      overviewMarker={{ id: mountain.id, name: mountain.name, coordinate: mountain.position as Coordinate, kind: 'mountain' }}
      highlightedRoute={screen === 'courseDetail' ? selectedCourse.coordinates : undefined}
      highlightedRouteColor={screen === 'courseDetail' ? selectedCourseColor : undefined}
      highlightedRoutes={showAllCourseRoutes ? allCourseRoutes : undefined}
      onViewportChange={screen === 'map' || screen === 'spotDetail' ? reportMapBounds : undefined}
      markers={screen === 'map' ? mapMarkers : screen === 'mountainDetail'
        ? [{ id: mountain.id, name: mountain.name, kind: 'mountain', coordinate: mountain.position as Coordinate }]
          : screen === 'spotDetail' ? visibleSpots.map(spot => ({ id: spot.id, name: spot.name, kind: 'spot' as const,
          coordinate: spot.coordinate, spotType: spot.type, targetType: spot.targetType, selected: spot.id === selectedSpot?.id })) : []}
      onMarkerSelect={screen === 'spotDetail' ? marker => focusSpot(marker.id) : screen === 'map' ? marker => {
        if (marker.kind === 'mountain') showDetail('mountain', marker.id)
        else if (marker.kind === 'course') showDetail('course', marker.id)
        else showDetail('spot', marker.id)
      } : undefined}>
      {screen === 'map' && <div className="community-map-filters" role="group" aria-label="지도와 후기 목록 유형 필터">
        {(['all', 'mountain', 'spot', 'course'] as const).map(category => <Chip key={category} selected={mapCategory === category}
          aria-controls="community-map-results" onClick={() => changeMapCategory(category)}
          label={category === 'all' ? '전체' : category === 'spot' ? '스팟' : category === 'course' ? '코스' : '산'} />)}
      </div>}
    </CommunityMap>}

    {screen === 'map' && <>
      {inlineMountainDetail ? <BottomSheet title={mountain.name} showClose={false}
        className={`community-page__sheet community-page__sheet--detail community-page__sheet--detail-mountain community-page__sheet--detail-level-${sheetLevel}${sheetPeek ? ' community-page__sheet--peek' : ''}`}
        headerAction={mountainHeaderScore}
        handleProps={handleProps} bodyHidden={sheetPeek}
        content={<div id="community-map-results">{mountainReviewContent}</div>}
        showFooter={!readOnly} footer={<Button fullWidth label="후기 등록" onClick={() => registerReview(() => beginReview('mountain', mountainId))} />} />
        : <BottomSheet title={mapCategory === 'spot' ? '스팟 사진·후기' : mapCategory === 'course' ? '코스 후기' : mapCategory === 'all' ? '전체 후기' : '지도에서 후기 보기'} headerAction={<ReviewEligibilityInfo />} showClose={false} className={`community-page__sheet community-page__sheet--map${mapCategory === 'spot' ? ' community-page__sheet--map-spot' : ''}${sheetPeek ? ' community-page__sheet--peek' : ''}`}
        handleProps={handleProps} bodyHidden={sheetPeek}
        content={<div id="community-map-results" className="community-map-results" aria-live="polite">
          {(mapCategory === 'all' || mapCategory === 'mountain') && <section className="community-map-section" aria-label="산 평점과 후기">
            <h3>산 평점·후기</h3>
            {communityLoading ? <CommunityRowsSkeleton count={1} /> : <button type="button" className="community-preview-row" onClick={() => showDetail('mountain', mountain.id)}>
              {mountainPhotoTotal > 0 ? <img className="community-preview-row__photo" src={mountainPhotos[0]} alt="" loading="lazy" />
                : <span className="community-preview-row__photo-placeholder" aria-hidden="true"><Icon name="Photo" size={24} /></span>}
              <span className="community-preview-row__text"><strong>{mountain.name}</strong>
                <small>{mountainRating === null ? '후기 0' : `★ ${mountainRating.toFixed(1)} · 후기 ${mountainReviewTotal}`}</small></span>
              <Icon name="ChevronRight" size={18} />
            </button>}
          </section>}
          {(mapCategory === 'all' || mapCategory === 'spot') && <section className="community-map-section" aria-label="스팟 사진과 후기">
            {mapCategory === 'spot' ? <div className="community-spot-filter">
              <SpotTypeDropdown value={spotTypeFilter} onChange={changeSpotTypeFilter} /></div>
              : <h3>스팟 사진·후기</h3>}
          {spotListLoading && visibleListedSpots.length === 0 && <CommunityRowsSkeleton />}
          {!spotListLoading && !spotListError && visibleListedSpots.length === 0 && <EmptyReviewPreview mountainName={mountain.name} kind="spot"
            message={spotTypeFilter !== 'all' && mapCategory === 'spot' ? '선택한 종류의 스팟이 없어요' : undefined} />}
          {(mapCategory === 'all' ? visibleListedSpots.slice(0, 5) : visibleListedSpots).map(spot => <div key={spot.id} className="community-spot-preview"><button type="button" className="community-preview-row" onClick={() => showDetail('spot', spot.id)}>
            {spot.photos[0] ?? currentReviews('spot', spot.id).flatMap(review => review.photos)[0]
              ? <img className="community-preview-row__photo" src={spot.photos[0] ?? currentReviews('spot', spot.id).flatMap(review => review.photos)[0]} alt="" loading="lazy" />
              : <span className="community-preview-row__photo-placeholder" aria-hidden="true"><Icon name="Photo" size={24} /></span>}
            <span className="community-preview-row__text"><strong>{spot.name}</strong>
              <small>사진 {Math.max(spot.baselinePhotos, spot.photos.length + currentReviews('spot', spot.id).flatMap(review => review.photos).length)}장 · 후기 {Math.max(spot.baselineReviews, currentReviews('spot', spot.id).length)}</small></span><Icon name="ChevronRight" size={18} /></button>
          </div>)}
          {mapCategory === 'spot' && <div ref={spotListEnd} role="status">{spotListLoading ? '스팟을 불러오는 중…' : ''}</div>}
          {spotListError && <button type="button" className="community-inline-link" onClick={() => {
            if (spotListCursor) setSpotListNextRetry(current => current + 1)
            else setSpotListFirstRetry(current => current + 1)
          }}>스팟 목록 다시 불러오기</button>}
          </section>}
          {(mapCategory === 'all' || mapCategory === 'course') && <section className="community-map-section" aria-label="코스 후기">
          {mapCategory === 'all' && <h3>코스 후기 ({visibleCourseTargets.length}개)</h3>}
          {communityLoading ? <CommunityRowsSkeleton /> : visibleCourseTargets.length > 0 ? visibleCourseTargets.map(course => {
            return <button key={course.id} type="button" className="community-preview-row" onClick={() => showDetail('course', course.id)}>
              {course.representativePhotoUrl ? <img className="community-preview-row__photo" src={course.representativePhotoUrl} alt="" loading="lazy" />
                : <span className="community-preview-row__photo-placeholder" aria-hidden="true"><Icon name="Photo" size={24} /></span>}
              <span className="community-preview-row__text"><span className="community-preview-row__heading">
                <span className="community-course-color" style={{ backgroundColor: communityCourseColor(course.name) }} aria-hidden="true" />
                <strong>{course.name}</strong></span>
                <small>{course.distanceKm} km · 후기 {course.baselineReviews}</small></span><Icon name="ChevronRight" size={18} /></button>
          })
            : <EmptyReviewPreview mountainName={mountain.name} kind="course" />}
          </section>}
        </div>}
        showFooter={!readOnly} footer={<Button fullWidth label="후기 등록" onClick={() => registerReview(() => {
          if (mapCategory === 'all') setReviewKindPickerOpen(true)
          else startMapReview(mapCategory)
        })} />} />}
      {reviewKindPickerOpen && <div className="community-review-kind-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setReviewKindPickerOpen(false) }}>
        <section ref={reviewPickerRef} className="community-review-kind-dialog" role="dialog" aria-modal="true" aria-labelledby="community-review-kind-title"
          onKeyDown={event => {
            if (event.key === 'Escape') { setReviewKindPickerOpen(false); event.stopPropagation() }
            if (event.key !== 'Tab') return
            const buttons = reviewPickerRef.current?.querySelectorAll<HTMLButtonElement>('button')
            if (!buttons?.length) return
            if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus() }
            else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus() }
          }}>
          <h2 id="community-review-kind-title">어떤 후기를 남길까요?</h2>
          <p>후기 유형을 선택해 주세요.</p>
          {(['mountain', 'spot', 'course'] as const).map(kind => <button type="button" key={kind} onClick={() => startMapReview(kind)}>
            {kind === 'mountain' ? '산 평점·후기' : kind === 'spot' ? '스팟 사진·후기' : '코스 후기'} <Icon name="ChevronRight" size={18} />
          </button>)}
          <button type="button" className="community-review-kind-dialog__cancel" onClick={() => setReviewKindPickerOpen(false)}>취소</button>
        </section>
      </div>}
    </>}

    {isDetail && <>
      <BottomSheet showClose={false} className={`community-page__sheet community-page__sheet--detail community-page__sheet--detail-${screen === 'mountainDetail' ? 'mountain' : screen === 'spotDetail' ? 'spot' : 'course'} community-page__sheet--detail-level-${sheetLevel}${sheetPeek ? ' community-page__sheet--peek' : ''}`}
        handleProps={handleProps} bodyHidden={sheetPeek}
        title={screen === 'mountainDetail' ? mountain.name : screen === 'spotDetail' ? selectedSpot?.name ?? '스팟' : selectedCourse.name}
        headerAction={screen === 'mountainDetail' && mountainRating !== null ? mountainHeaderScore : undefined}
        content={screen === 'mountainDetail' ? mountainReviewContent : screen === 'spotDetail' ? selectedSpot && (isSpotHidden(votes[selectedSpot.id]) ?
          <><EmptyState showIcon={false} title="이 스팟은 현재 숨겨져 있어요." description="부정 평가가 기준에 도달해 지도와 목록에 표시되지 않습니다. 내 평가를 취소하거나 변경하면 다시 표시될 수 있어요." />
            {votes[selectedSpot.id]?.viewer && <section className="community-vote"><h3>내 평가 변경</h3><div><button type="button" disabled={readOnly} aria-pressed={votes[selectedSpot.id]?.viewer === 'yes'} onClick={() => castVote('yes')}>맞는 정보예요 <span>{votes[selectedSpot.id]?.yes ?? 0}</span></button><button type="button" disabled={readOnly} aria-pressed={votes[selectedSpot.id]?.viewer === 'no'} onClick={() => castVote('no')}>맞지 않아요 <span>{votes[selectedSpot.id]?.no ?? 0}</span></button></div></section>}</> : <>
            <p className="community-detail-meta">사진 {Math.max(selectedSpot.baselinePhotos, spotGalleryPhotos.length)}장 · 후기 {Math.max(selectedSpot.baselineReviews, selectedSpotReviews.length)}</p>
            <div className="community-detail-photos">{spotGalleryPhotos.length > 0 && <CommunityPhotoStrip kindLabel="스팟" photos={spotGalleryPhotos}
              totalCount={selectedSpot.baselinePhotos} endRef={photoStripEnd} onViewAll={() => openGallery('spot')} onOpen={id => openGalleryPhoto('spot', id)} />}{photoStatus}
              {spotGalleryPhotos.length === 0 && !photoPage.loading && !photoPage.error && <p className="community-gallery-empty">아직 등록된 사진이 없어요.</p>}</div>
            <div className="community-review-heading"><strong>방문자 후기</strong>
              {selectedSpotReviews.length > 0 &&
                <button type="button" aria-label={`${selectedSpot.name} 후기 전체보기`} onClick={() => move('spotReviewList')}>전체보기 <Icon name="ChevronRight" size={16} /></button>}
            </div>
            <ReviewQuotes reviews={selectedSpotReviews} limit={3} />
            <section className="community-vote"><h3>이 스팟 정보가 맞나요?</h3><p>다른 사용자가 위치와 종류를 확인하는 데 도움이 돼요.</p>
              <div><button type="button" disabled={readOnly} aria-pressed={votes[selectedSpot.id]?.viewer === 'yes'} onClick={() => castVote('yes')}>맞는 정보예요 <span>{votes[selectedSpot.id]?.yes ?? 0}</span></button>
                <button type="button" disabled={readOnly} aria-pressed={votes[selectedSpot.id]?.viewer === 'no'} onClick={() => castVote('no')}>맞지 않아요 <span>{votes[selectedSpot.id]?.no ?? 0}</span></button></div>
            </section>
          </>) : <>
          <p className="community-detail-meta">{selectedCourse.distanceKm} km · 후기 {Math.max(selectedCourse.baselineReviews, courseReviews.length)}</p>
          <div className="community-detail-photos">{courseGalleryPhotos.length > 0 && <CommunityPhotoStrip kindLabel="코스" photos={courseGalleryPhotos}
            totalCount={selectedCourse.baselinePhotos} endRef={photoStripEnd} onViewAll={() => openGallery('course')} onOpen={id => openGalleryPhoto('course', id)} />}{photoStatus}
            {courseGalleryPhotos.length === 0 && !photoPage.loading && !photoPage.error && <p className="community-gallery-empty">아직 등록된 사진이 없어요.</p>}</div>
          <div className="community-review-heading"><strong>방문자 후기</strong>
            {courseReviews.length > 0 &&
              <button type="button" aria-label={`${selectedCourse.name} 후기 전체보기`} onClick={() => move('courseReviewList')}>전체보기 <Icon name="ChevronRight" size={16} /></button>}
          </div>
          <ReviewQuotes reviews={courseReviews} limit={3} />
        </>}
        showFooter={!readOnly && !(screen === 'spotDetail' && selectedSpot && isSpotHidden(votes[selectedSpot.id]))}
        footer={<Button fullWidth label="후기 등록" onClick={() => registerReview(() => {
          if (screen === 'mountainDetail') beginReview('mountain', mountainId)
          else if (screen === 'spotDetail' && selectedSpot) beginReview('spot', selectedSpot.id)
          else beginReview('course', selectedCourse.id)
        })} />} />
    </>}

    {screen === 'photoAlbum' && <><CommunityPhotoAlbum photos={galleryPhotos} title={galleryTitle} onOpen={id => openGalleryPhoto(galleryKind, id)} />
      {photoPage.hasNext && <div ref={photoAlbumEnd} role="status">{photoPage.loading ? '사진을 더 불러오는 중…' : ''}</div>}
      {photoStatus}</>}
    {screen === 'spotReviewList' && selectedSpot && <section className="community-gallery-page community-review-list-page" aria-label={`${selectedSpot.name} 후기 목록`}>
      <h2>{selectedSpot.name} 후기</h2>
      {reviewList.key === reviewListKey && (fullReviews.length > 0 || !reviewList.loading) && <ReviewQuotes reviews={fullReviews}
        photos={fullReviewPhotos} onPhotoOpen={id => setLightboxPhoto(fullReviewPhotos.find(photo => photo.id === id) ?? null)} />}
      {fullReviewStatus}
    </section>}
    {screen === 'mountainReviewList' && <section className="community-gallery-page community-review-list-page" aria-label={`${mountain.name} 후기 목록`}>
      <h2>{mountain.name} 후기</h2>
      {reviewList.key === reviewListKey && (fullReviews.length > 0 || !reviewList.loading) && <ReviewQuotes reviews={fullReviews} showRating
        photos={fullReviewPhotos} onPhotoOpen={id => setLightboxPhoto(fullReviewPhotos.find(photo => photo.id === id) ?? null)} />}
      {fullReviewStatus}
    </section>}
    {screen === 'courseReviewList' && <section className="community-gallery-page community-review-list-page" aria-label={`${selectedCourse.name} 후기 목록`}>
      <h2>{selectedCourse.name} 후기</h2>
      {reviewList.key === reviewListKey && (fullReviews.length > 0 || !reviewList.loading) && <ReviewQuotes reviews={fullReviews}
        photos={fullReviewPhotos} onPhotoOpen={id => setLightboxPhoto(fullReviewPhotos.find(photo => photo.id === id) ?? null)} />}
      {fullReviewStatus}
    </section>}
    {screen === 'photoReview' && selectedGalleryPhoto && <CommunityPhotoReview photo={selectedGalleryPhoto} kind={galleryKind} index={selectedGalleryIndex} total={galleryPhotos.length}
      onPrevious={() => setGalleryPhotoId(galleryPhotos[selectedGalleryIndex - 1].id)}
      onNext={() => setGalleryPhotoId(galleryPhotos[selectedGalleryIndex + 1].id)} />}

    {lightboxPhoto?.src && <ModalLayer className="community-photo-lightbox" onDismiss={() => setLightboxPhoto(null)}
      onPointerDown={event => { if (event.target === event.currentTarget) setLightboxPhoto(null) }}>
      <div className="community-photo-lightbox__dialog" role="dialog" aria-modal="true" aria-label="후기 사진 크게 보기">
        <button type="button" className="community-photo-lightbox__close" aria-label="사진 닫기" onClick={() => setLightboxPhoto(null)}><Icon name="Close" size={24} color="currentColor" /></button>
        <img src={lightboxPhoto.src} alt="확대한 후기 사진" />
      </div>
    </ModalLayer>}

    {screen === 'review' && <ReviewForm draft={draft} mountainName={mountain.name} spot={draftSpot} errors={errors}
      canSubmit={!submitting && reviewEligibleCourses.length > 0 && (draft.kind !== 'course' || reviewEligibleCourses.some(hike => hike.courseId === draft.targetId && hike.id === draft.completedHikeId))}
      eligibleCourses={reviewEligibleCourses}
      onChange={updateDraft} onError={notify} onChooseSpot={() => { setPickerSpotId(draft.targetId || null); move('spotPicker') }}
      onNewSpot={() => move('newSpot')} onSubmit={submitReview} />}

    {screen === 'spotPicker' && <div className="community-form-layout community-picker">
      <div className="community-form-layout__scroll"><h2>스팟 위치 선택</h2><p className="community-form-subtitle">지도에서 등록된 스팟을 고르거나 새 위치를 지정해 주세요.</p>
        <div className="community-picker__map"><CommunityMap markers={pickSpotMarkers} mountainId={terrainMountainId} center={selectedCourse.coordinates[3] ?? mountain.position as Coordinate} zoom={14.8}
          showRoute={selectedCourse.coordinates.length > 1} highlightedRoute={selectedCourse.coordinates}
          onViewportChange={reportMapBounds} onMarkerSelect={marker => setPickerSpotId(marker.id)} ariaLabel="등록된 스팟 선택" /></div>
        <p className="community-picker__selection">{visibleSpots.find(spot => spot.id === pickerSpotId)?.name ? `선택한 스팟 · ${visibleSpots.find(spot => spot.id === pickerSpotId)?.name}` : '스팟을 선택해 주세요.'}</p>
        <button type="button" className="community-inline-link" onClick={() => move('newSpot')}>찾는 스팟이 없나요? 새 스팟 등록</button>
      </div><div className="community-form-layout__action"><Button fullWidth label="이 스팟으로 후기 작성" onClick={() => {
        if (!pickerSpotId || !visibleSpots.some(spot => spot.id === pickerSpotId)) { notify('스팟을 선택해 주세요.'); return }
        void beginReview('spot', pickerSpotId)
      }} /></div>
    </div>}

    {screen === 'newSpot' && <SpotRegistration spots={spots} votes={votes} mountainId={mountainId} mountainCenter={mountain.position as Coordinate}
      terrainMountainId={terrainMountainId} routeCoordinates={selectedCourse.coordinates} mode={spotRegistrationMode}
      onViewportChange={reportMapBounds}
      recentCourses={spotRegistrationCourses} selectedHikeId={spotHikeId} onCourseSelect={setSpotHikeId} onError={notify}
      onCreate={async (spot, photos, distinct) => {
        const hike = eligibleCourses.find(item => item.id === spotHikeId) ?? eligibleCourses[0]
        if (!hike) { notify(reviewEligibilityMessage); return }
        const created = await communityApi.createSpot(mountainId, {
          hikeRecordId: Number(hike.id), type: spot.type, name: spot.name, coordinate: spot.coordinate, confirmDistinct: distinct,
        })
        const uploaded = await communityApi.uploadPhotos('USER_SPOT', created.spotId, photos)
        photos.forEach(photo => URL.revokeObjectURL(photo.previewUrl))
        const saved: CommunitySpot = {
          id: `USER_SPOT:${created.spotId}`, targetId: String(created.spotId), targetType: 'USER_SPOT', name: created.name, type: fromSpotType(created.type),
          coordinate: [created.longitude, created.latitude], mountainId: String(created.mountainId), status: created.status,
          baselinePhotos: uploaded.length, baselineReviews: 0, photos: uploaded.map(photo => photo.url),
        }
        mapSpotCache.current.clear()
        setMapSpots(current => [...current.filter(item => item.id !== saved.id), saved])
        setSpots(current => [...current, saved]); setVotes(current => ({ ...current, [saved.id]: { yes: 0, no: 0, viewer: null } })); setDetailSpotId(saved.id)
        if (onSpotRegistered) { onSpotRegistered(); return }
        setReviewEligibleCourses(eligibleCourses)
        if (screens.includes('review')) { updateDraft({ kind: 'spot', targetId: saved.id, completedHikeId: hike.id }); setScreens(current => current.slice(0, -1)) }
        else { setDraft({ ...blankDraft('spot', saved.id), completedHikeId: hike.id }); setScreens(['mountainSelect', 'map', 'review']) }
        notify('스팟을 등록했어요. 이어서 후기를 작성해 주세요.')
      }}
      onUseExisting={(spot, photos) => {
        const hike = eligibleCourses.find(item => item.id === spotHikeId) ?? eligibleCourses[0]
        setDetailSpotId(spot.id)
        if (onSpotRegistered) { onSpotRegistered(); return }
        setReviewEligibleCourses(eligibleCourses)
        if (screens.includes('review')) { updateDraft({ kind: 'spot', targetId: spot.id, completedHikeId: hike?.id, photos }); setScreens(current => current.slice(0, -1)) }
        else { setDraft({ ...blankDraft('spot', spot.id), completedHikeId: hike?.id, photos }); setScreens(['mountainSelect', 'map', 'review']) }
        notify('기존 스팟을 선택했습니다. 사진을 추가하고 후기를 이어서 작성할 수 있어요.')
      }} />}

    <BottomNavigation active="community" onNavigate={handleBottomNavigation} className="community-page__nav" />
    {toast && <Toast key={toast.id} message={toast.message} className="community-page__toast" />}
  </main>
}
