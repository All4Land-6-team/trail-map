import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { Icon } from '../../../components/common/Icon'
import { ReviewEnvironmentBadge } from '../../../components/review/ReviewEnvironmentBadge'
import { ReviewRating } from '../../../components/review/ReviewRating'
import type { CommunityReview, ReviewEnvironment, ReviewKind } from '../../../types/community'

export type CommunityGalleryPhoto = {
  id: string
  src?: string
  review?: CommunityReview
  exampleText?: string
  exampleRating?: number
  exampleDate?: string
  author?: string
  environment?: ReviewEnvironment
  source: 'review' | 'spot' | 'example'
}

type GalleryProps = {
  photos: readonly CommunityGalleryPhoto[]
  onOpen: (id: string) => void
}

function PhotoContent({ photo, onImageSettled }: { photo: CommunityGalleryPhoto; onImageSettled?: () => void }) {
  return photo.src
    ? <img src={photo.src} alt={photo.source === 'example' ? '화면용 예시 사진' : photo.source === 'review' ? '방문자가 후기에 올린 사진' : '스팟에 등록된 사진'} loading="lazy"
        onLoad={onImageSettled} onError={onImageSettled} />
    : <span className="community-gallery-placeholder"><Icon name="Peak" size={30} /><small>원본 사진 준비 중</small></span>
}

export function CommunityPhotoStrip({ photos, onOpen, onViewAll, kindLabel, headingAside, totalCount, endRef }: GalleryProps & { onViewAll: () => void; kindLabel: string; headingAside?: ReactNode; totalCount?: number; endRef?: RefObject<HTMLButtonElement | null> }) {
  if (photos.length === 0) return <div className="community-gallery-empty">아직 등록된 사진이 없어요.</div>
  return <>
    <div className="community-gallery-heading"><strong>사진 {totalCount ?? photos.length}장</strong>{headingAside}</div>
    <div className="community-gallery-strip" role="region" aria-label={`${kindLabel} 사진 가로 목록`} tabIndex={0}>
      {photos.map((photo, index) => <button type="button" key={photo.id} ref={index === photos.length - 1 ? endRef : undefined} className="community-gallery-tile"
        aria-label={`${index + 1}번째 사진, ${photo.source === 'example' ? '예시 사진' : photo.source === 'review' ? '후기 사진' : '스팟 등록 사진'} 보기`}
        onClick={() => onOpen(photo.id)}><PhotoContent photo={photo} /></button>)}
      <button type="button" className="community-gallery-more-card" aria-label={`${kindLabel} 사진 더보기`} onClick={onViewAll}>
        <span>사진<br />더보기</span>
      </button>
    </div>
  </>
}

export function CommunityPhotoAlbum({ photos, onOpen, title, loading, children }: GalleryProps & { title: string; loading: boolean; children?: ReactNode }) {
  return <section className="community-gallery-page community-gallery-album" aria-label={`${title} 사진첩`}>
    <div className="community-gallery-page__intro"><h2>{title} 사진첩</h2></div>
    <div className="community-gallery-grid" role={loading ? 'status' : undefined} aria-label={loading ? '사진을 불러오는 중' : undefined}>{photos.map((photo, index) => <button type="button" key={photo.id}
      className="community-gallery-tile" aria-label={`${index + 1}번째 사진 보기`} onClick={() => onOpen(photo.id)}>
      <PhotoContent photo={photo} />
    </button>)}{loading && Array.from({ length: 6 }, (_, index) => <span key={index} className="community-gallery-grid__skeleton" aria-hidden="true" />)}</div>
    {children}
  </section>
}

export function CommunityPhotoReview({ photo, detail, showDetailSkeleton, detailError, onRetry, kind, index, total, onPrevious, onNext }: {
  photo: CommunityGalleryPhoto
  detail: CommunityGalleryPhoto | null
  showDetailSkeleton: boolean
  detailError: boolean
  onRetry: () => void
  kind: ReviewKind
  index: number
  total: number
  onPrevious: () => void
  onNext: () => void
}) {
  const pointerStart = useRef<{ id: number; x: number; y: number } | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [showImageSkeleton, setShowImageSkeleton] = useState(false)
  useEffect(() => {
    if (!photo.src || imageLoaded) return
    const timer = window.setTimeout(() => setShowImageSkeleton(true), 200)
    return () => window.clearTimeout(timer)
  }, [photo.src, imageLoaded])
  const changePhoto = (direction: 'previous' | 'next') => {
    if (direction === 'previous' && index > 0) onPrevious()
    if (direction === 'next' && index < total - 1) onNext()
  }
  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
    pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start || start.id !== event.pointerId) return
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.3) return
    changePhoto(deltaX > 0 ? 'previous' : 'next')
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    changePhoto(event.key === 'ArrowLeft' ? 'previous' : 'next')
  }
  const nickname = detail?.review?.author ?? detail?.author ?? (detail?.source === 'example' ? '등산객' : '스팟 등록자')
  const rating = detail?.review?.rating ?? detail?.exampleRating
  const date = detail?.review
    ? new Date(detail.review.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    : detail?.exampleDate ?? '작성일 미기록'
  const content = detail?.review?.content ?? detail?.exampleText ?? '이 사진에 연결된 후기 글은 아직 없어요.'
  return <section className="community-gallery-page community-gallery-review" role="region" aria-label="사진 후기, 좌우로 밀거나 방향키로 사진 이동"
    tabIndex={0} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerCancel={() => { pointerStart.current = null }}
    onDragStart={event => event.preventDefault()} onKeyDown={handleKeyDown}>
    <div className="community-gallery-review__top"><h2>사진 후기</h2><span aria-live="polite">{index + 1} / {total}</span></div>
    <div className={`community-gallery-review__image${photo.src && !imageLoaded ? ' community-gallery-review__image--loading' : ''}`}>
      {photo.src && !imageLoaded && showImageSkeleton && <span className="community-gallery-review__image-skeleton" aria-hidden="true" />}
      <PhotoContent photo={photo} onImageSettled={() => setImageLoaded(true)} />
    </div>
    <article className={`community-gallery-review__text${detail ? '' : ' community-gallery-review__text--loading'}`}>
      {detail ? <><div className="community-gallery-review__record"><time dateTime={detail.review?.createdAt}>{date}</time>
        <span className="community-gallery-review__weather"><ReviewEnvironmentBadge environment={detail.environment ?? detail.review?.environment} /></span></div>
        <div className="community-gallery-review__author-row"><strong>{nickname}</strong>
          {kind === 'course' && (rating != null ? <span className="community-gallery-review__rating"><ReviewRating value={rating} /></span> : <span>평점 없음</span>)}</div>
        <p>{content}</p></> : detailError
        ? <button type="button" className="community-inline-link" onClick={onRetry}>사진 후기 다시 불러오기</button>
        : showDetailSkeleton && <div className="community-gallery-review-skeleton__copy" role="status" aria-label="후기 정보를 불러오는 중">
          <span /><span /><span />
        </div>}
    </article>
  </section>
}
