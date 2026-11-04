import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'

type SheetLevel = 'peek' | 'content'
export type DetailSheetLevel = 'collapsed' | 'peek' | 'photo' | 'reviews' | 'expanded'
const PEEK_HEIGHT = 40
const DETAIL_COLLAPSED_HEIGHT = 40
const DETAIL_PEEK_HEIGHT = 128
const MIN_VISIBLE_MAP = 170
const DETAIL_MAP_CLEARANCE = 96
const REVIEW_HEIGHT = 485
const COMPACT_REVIEW_HEIGHT = 464
const PHOTO_HEIGHT = 310
const PHOTO_STAGE_GAP = 8
const REVIEW_TO_FULL_GAP = 55
const SNAP_MAGNET_DISTANCE = 22
const DETAIL_LEVELS: DetailSheetLevel[] = ['collapsed', 'peek', 'photo', 'reviews', 'expanded']
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** 후기 지도는 고정하고 공통 BottomSheet만 손잡이로 이동한다. */
export function useCommunitySheet(detail = false, mapPreview = false, compactDetail = false, expandableDetail = false, detailCanReachTop = false, detailKey = '') {
  const rootRef = useRef<HTMLElement>(null)
  const naturalHeight = useRef(240)
  const drag = useRef<{ id: number; y: number; height: number; content: number; moved: boolean } | null>(null)
  const settleTimer = useRef<number | null>(null)
  const animationFrame = useRef<number | null>(null)
  // Touch browsers can synthesize a click after pointerup, after a zero-delay timer has run.
  const suppressClickUntil = useRef(0)
  const [level, setLevel] = useState<SheetLevel>('content')
  const [detailLevel, setDetailLevel] = useState<DetailSheetLevel>('reviews')
  const [measuredDetailKey, setMeasuredDetailKey] = useState(detailKey)
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const [photoHeight, setPhotoHeight] = useState(PHOTO_HEIGHT)
  const [dragging, setDragging] = useState(false)
  useEffect(() => () => {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
    if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current)
  }, [])
  useLayoutEffect(() => {
    if (!detail || !detailKey) return
    stopAnimation()
    setDragging(false)
    setDragHeight(null)
    setPhotoHeight(PHOTO_HEIGHT)
    setDetailLevel('reviews')
    setMeasuredDetailKey(detailKey)
  }, [detail, detailKey])
  useLayoutEffect(() => {
    if (!detail || detailLevel === 'peek') return
    const content = rootRef.current?.querySelector<HTMLElement>('.community-page__sheet .af-bottom-sheet__content')
    if (!content) return
    if (detailLevel === 'photo') {
      content.scrollTop = 0
      setPhotoHeight(measuredPhotoHeight())
    }
  }, [detail, detailLevel])

  function currentSheet() { return rootRef.current?.querySelector<HTMLElement>('.community-page__sheet') }
  function measuredPhotoHeight() {
    const sheet = currentSheet()
    const photos = sheet?.querySelector<HTMLElement>('.community-detail-photos')
    const footer = sheet?.querySelector<HTMLElement>('.af-bottom-sheet__footer')
    if (!sheet || !photos || !footer) return PHOTO_HEIGHT
    const sheetStyle = getComputedStyle(sheet)
    const target = photos.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top + PHOTO_STAGE_GAP
      + footer.getBoundingClientRect().height + (Number.parseFloat(sheetStyle.paddingBottom) || 0)
    return clamp(target, PEEK_HEIGHT, maximumHeight())
  }
  function maximumHeight() {
    const navHeight = rootRef.current?.querySelector<HTMLElement>('.community-page__nav')?.getBoundingClientRect().height ?? 70
    return Math.max(PEEK_HEIGHT, (rootRef.current?.getBoundingClientRect().height ?? 844) - navHeight - (detail ? detailCanReachTop ? 0 : DETAIL_MAP_CLEARANCE : MIN_VISIBLE_MAP))
  }
  function expandedHeight() {
    const sheet = currentSheet()
    const content = sheet?.querySelector<HTMLElement>('.af-bottom-sheet__content')
    const body = sheet?.querySelector<HTMLElement>('.af-bottom-sheet__body')
    const footer = body?.querySelector<HTMLElement>('.af-bottom-sheet__footer')
    if (!expandableDetail || !sheet || !content || !body || !footer) return REVIEW_HEIGHT
    const currentHeight = sheet.getBoundingClientRect().height
    const bodyGap = Number.parseFloat(getComputedStyle(body).rowGap || getComputedStyle(body).gap) || 0
    const sheetStyle = getComputedStyle(sheet)
    const target = content.getBoundingClientRect().top - sheet.getBoundingClientRect().top + content.scrollHeight
      + footer.getBoundingClientRect().height + bodyGap + (Number.parseFloat(sheetStyle.paddingBottom) || 0)
    return clamp(target, currentHeight, maximumHeight())
  }
  function measuredReviewHeight() {
    const fallback = Math.min(compactDetail ? COMPACT_REVIEW_HEIGHT : REVIEW_HEIGHT, maximumHeight() - REVIEW_TO_FULL_GAP)
    const sheet = currentSheet()
    const body = sheet?.querySelector<HTMLElement>('.af-bottom-sheet__body')
    const content = body?.querySelector<HTMLElement>('.af-bottom-sheet__content')
    const carousel = sheet?.querySelector<HTMLElement>('.community-review-carousel')
    const footer = body?.querySelector<HTMLElement>('.af-bottom-sheet__footer')
    if (!sheet || !body || !content || !carousel || !footer) return clamp(fallback, PEEK_HEIGHT, maximumHeight())
    const bodyGap = Number.parseFloat(getComputedStyle(body).rowGap || getComputedStyle(body).gap) || 0
    const sheetStyle = getComputedStyle(sheet)
    const carouselBottom = carousel.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top
    const target = carouselBottom + footer.getBoundingClientRect().height + bodyGap
      + (Number.parseFloat(sheetStyle.paddingTop) || 0) + (Number.parseFloat(sheetStyle.paddingBottom) || 0)
    return clamp(target, PEEK_HEIGHT, maximumHeight())
  }
  function measuredNameHeight() {
    const sheet = currentSheet()
    const body = sheet?.querySelector<HTMLElement>('.af-bottom-sheet__body')
    const title = body?.querySelector<HTMLElement>('.af-bottom-sheet__title-row')
    const footer = body?.querySelector<HTMLElement>('.af-bottom-sheet__footer')
    if (!sheet || !body || !title || !footer) return DETAIL_PEEK_HEIGHT
    const bodyGap = Number.parseFloat(getComputedStyle(body).rowGap || getComputedStyle(body).gap) || 0
    const sheetStyle = getComputedStyle(sheet)
    const target = title.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top
      + bodyGap + footer.getBoundingClientRect().height + (Number.parseFloat(sheetStyle.paddingBottom) || 0)
    return clamp(target, PEEK_HEIGHT, maximumHeight())
  }
  function heightForDetail(next: DetailSheetLevel) {
    const maximum = maximumHeight()
    return next === 'collapsed' ? clamp(DETAIL_COLLAPSED_HEIGHT, 0, maximum) : next === 'peek' ? measuredNameHeight() : next === 'reviews' ? measuredReviewHeight()
      : next === 'photo' ? photoHeight : expandedHeight()
  }
  function magnetizedHeight(rawHeight: number) {
    if (!detail) return rawHeight
    const stops = DETAIL_LEVELS.map(item => ({ height: heightForDetail(item) }))
    const closest = stops.reduce((previous, candidate) => Math.abs(candidate.height - rawHeight) < Math.abs(previous.height - rawHeight) ? candidate : previous)
    return Math.abs(closest.height - rawHeight) <= SNAP_MAGNET_DISTANCE ? closest.height : rawHeight
  }
  const currentLevel = detail ? detailLevel : level
  function contentHeight() {
    if (mapPreview) return maximumHeight()
    if (!detail && level === 'content' && dragHeight === null) naturalHeight.current = currentSheet()?.getBoundingClientRect().height ?? naturalHeight.current
    return clamp(naturalHeight.current, PEEK_HEIGHT, maximumHeight())
  }
  function stopAnimation() {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
    if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current)
  }
  function settle(next: SheetLevel | DetailSheetLevel, from: number, to: number) {
    stopAnimation()
    setDragging(false)
    setDragHeight(from)
    if (detail) setDetailLevel(next as DetailSheetLevel)
    else setLevel(next as SheetLevel)
    animationFrame.current = window.requestAnimationFrame(() => {
      animationFrame.current = window.requestAnimationFrame(() => setDragHeight(to))
    })
    settleTimer.current = window.setTimeout(() => setDragHeight(null), 240)
  }
  function changeLevel(next: SheetLevel | DetailSheetLevel) {
    if (next === currentLevel && dragHeight === null) return
    const from = currentSheet()?.getBoundingClientRect().height ?? PEEK_HEIGHT
    const to = detail ? heightForDetail(next as DetailSheetLevel) : next === 'peek' ? PEEK_HEIGHT : contentHeight()
    settle(next, from, to)
  }
  function step(direction: 1 | -1) {
    if (!detail) return direction === 1 ? 'content' : 'peek'
    if (detailLevel === 'peek' && direction === 1) return 'reviews'
    const index = DETAIL_LEVELS.indexOf(detailLevel)
    return DETAIL_LEVELS[clamp(index + direction, 0, DETAIL_LEVELS.length - 1)]
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowUp') changeLevel(step(1))
    else if (event.key === 'ArrowDown') changeLevel(step(-1))
    else if (event.key === 'Home') changeLevel(detail ? 'reviews' : 'content')
    else if (event.key === 'End') changeLevel(detail ? 'collapsed' : 'peek')
    else if (event.key === 'Enter' || event.key === ' ') changeLevel(currentLevel === (detail ? 'reviews' : 'content')
      ? 'peek' : step(1))
    else return
  }
  function finish(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    if (current.moved) {
      const height = clamp(current.height + current.y - event.clientY, PEEK_HEIGHT, current.content)
      if (detail) {
        // A single swipe moves through one stop at a time.
        const distance = current.y - event.clientY
        const stops = DETAIL_LEVELS.map(item => ({ item, height: heightForDetail(item) }))
        const next: DetailSheetLevel = Math.abs(distance) < 20
          ? detailLevel
          : stops.reduce((closest, candidate) => Math.abs(candidate.height - height) < Math.abs(closest.height - height) ? candidate : closest).item
        settle(next, height, heightForDetail(next))
      } else {
        const next = height < (PEEK_HEIGHT + current.content) / 2 ? 'peek' : 'content'
        settle(next, height, next === 'peek' ? PEEK_HEIGHT : current.content)
      }
      suppressClickUntil.current = window.performance.now() + 500
    } else {
      setDragHeight(null)
      setDragging(false)
    }
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const peek = currentLevel === 'peek' && dragHeight === null
  const collapsed = detail && currentLevel === 'collapsed' && dragHeight === null
  const detailReady = measuredDetailKey === detailKey
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
    if ((event.target as HTMLElement).closest('button, a, input, textarea, select')) return
    drag.current = { id: event.pointerId, y: event.clientY,
      height: currentSheet()?.getBoundingClientRect().height ?? PEEK_HEIGHT,
      content: detail ? maximumHeight() : contentHeight(), moved: false }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    event.preventDefault()
    if (Math.abs(event.clientY - current.y) > 5) current.moved = true
    if (current.moved) {
      const rawHeight = clamp(current.height + current.y - event.clientY, PEEK_HEIGHT, current.content)
      const nextHeight = magnetizedHeight(rawHeight)
      setDragHeight(nextHeight)
    }
  }
  const onPointerCancel = () => { drag.current = null; setDragging(false); setDragHeight(null) }
  return {
    rootRef,
    style: { '--community-sheet-transition': dragging || dragHeight === null || !detailReady ? 'none' : 'height 240ms cubic-bezier(0.22, 1, 0.36, 1)', '--community-sheet-height': dragHeight === null
      ? detail ? !detailReady ? `${REVIEW_HEIGHT}px` : detailLevel === 'collapsed' ? `${DETAIL_COLLAPSED_HEIGHT}px` : detailLevel === 'peek' ? `${measuredNameHeight()}px` : detailLevel === 'reviews' ? `${measuredReviewHeight()}px` : detailLevel === 'photo' ? `${photoHeight}px` : `${expandedHeight()}px`
        : level === 'content' ? mapPreview ? 'min(420px, calc(var(--app-viewport-height) - var(--community-nav-height) - 170px))' : 'auto' : `${PEEK_HEIGHT}px`
      : `${dragHeight}px` } as CSSProperties,
    peek,
    collapsed,
    level: currentLevel,
    sheetDragProps: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel },
    reset: () => { stopAnimation(); setDragging(false); setLevel('content'); setDetailLevel('reviews'); setDragHeight(null) },
    handleProps: {
      role: 'button', tabIndex: 0, 'aria-label': detail ? `바텀시트 ${detailLevel === 'collapsed' ? '아래 내림' : detailLevel === 'peek' ? '이름 보기' : detailLevel === 'reviews' ? '기본 보기' : detailLevel === 'photo' ? '사진 보기' : '확장 보기'}. 탭하거나 위아래 방향키로 단계 변경` : peek ? '바텀시트 열기' : '바텀시트 내리기', 'aria-expanded': !peek && !collapsed,
      onKeyDown,
      onClick: (event: MouseEvent<HTMLDivElement>) => {
        if (event.detail !== 0 && window.performance.now() < suppressClickUntil.current) return
        changeLevel(detail
        ? detailLevel === 'expanded' ? 'reviews' : detailLevel === 'reviews' ? 'photo' : detailLevel === 'photo' ? 'peek' : detailLevel === 'peek' ? 'collapsed' : 'reviews'
          : peek ? 'content' : 'peek')
      },
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel,
    },
  }
}
