import { useRef, type KeyboardEvent, type ReactNode, type TouchEvent } from 'react'
import { Icon } from '../../../components/common/Icon'
import type { CommunityReview, ReviewKind } from '../../../types/community'

export type CommunityGalleryPhoto = {
  id: string
  src?: string
  review?: CommunityReview
  exampleText?: string
  exampleRating?: number
  exampleDate?: string
  source: 'review' | 'spot' | 'example'
}

type GalleryProps = {
  photos: readonly CommunityGalleryPhoto[]
  onOpen: (id: string) => void
}

function PhotoContent({ photo }: { photo: CommunityGalleryPhoto }) {
  return photo.src
    ? <img src={photo.src} alt={photo.source === 'example' ? '화면용 예시 사진' : photo.review ? '방문자가 후기에 올린 사진' : '스팟에 등록된 사진'} loading="lazy" />
    : <span className="community-gallery-placeholder"><Icon name="Peak" size={30} /><small>원본 사진 준비 중</small></span>
}

export function CommunityPhotoStrip({ photos, onOpen, onViewAll, kindLabel, headingAside }: GalleryProps & { onViewAll: () => void; kindLabel: string; headingAside?: ReactNode }) {
  if (photos.length === 0) return <div className="community-gallery-empty">아직 등록된 사진이 없어요.</div>
  return <>
    <div className="community-gallery-heading"><strong>사진 {photos.length}장</strong>{headingAside}<button type="button" onClick={onViewAll}>전체보기 <Icon name="ChevronRight" size={16} /></button></div>
    <div className="community-gallery-strip" role="region" aria-label={`${kindLabel} 사진 가로 목록`} tabIndex={0}>
      {photos.map((photo, index) => <button type="button" key={photo.id} className="community-gallery-tile"
        aria-label={`${index + 1}번째 사진, ${photo.source === 'example' ? '예시 사진' : photo.source === 'review' ? '후기 사진' : '스팟 등록 사진'} 보기`}
        onClick={() => onOpen(photo.id)}><PhotoContent photo={photo} /></button>)}
    </div>
  </>
}

export function CommunityPhotoAlbum({ photos, onOpen, title }: GalleryProps & { title: string }) {
  return <section className="community-gallery-page community-gallery-album" aria-label={`${title} 사진첩`}>
    <div className="community-gallery-page__intro"><h2>{title} 사진첩</h2></div>
    <div className="community-gallery-grid">{photos.map((photo, index) => <button type="button" key={photo.id}
      className="community-gallery-tile" aria-label={`${index + 1}번째 사진 보기`} onClick={() => onOpen(photo.id)}>
      <PhotoContent photo={photo} />
    </button>)}</div>
  </section>
}

export function CommunityPhotoReview({ photo, kind, index, total, onPrevious, onNext }: {
  photo: CommunityGalleryPhoto
  kind: ReviewKind
  index: number
  total: number
  onPrevious: () => void
  onNext: () => void
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const changePhoto = (direction: 'previous' | 'next') => {
    if (direction === 'previous' && index > 0) onPrevious()
    if (direction === 'next' && index < total - 1) onNext()
  }
  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1) { touchStart.current = null; return }
    touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }
  }
  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start || event.changedTouches.length !== 1) return
    const deltaX = event.changedTouches[0].clientX - start.x
    const deltaY = event.changedTouches[0].clientY - start.y
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.3) return
    changePhoto(deltaX > 0 ? 'previous' : 'next')
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    changePhoto(event.key === 'ArrowLeft' ? 'previous' : 'next')
  }
  const nickname = photo.review ? '나' : photo.source === 'example' ? '등산객' : '스팟 등록자'
  const rating = photo.review?.rating ?? photo.exampleRating
  const date = photo.review
    ? new Date(photo.review.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    : photo.exampleDate ?? '작성일 미기록'
  const content = photo.review?.content ?? photo.exampleText ?? '이 사진에 연결된 후기 글은 아직 없어요.'
  return <section className="community-gallery-page community-gallery-review" role="region" aria-label="사진 후기, 좌우로 밀거나 방향키로 사진 이동"
    tabIndex={0} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchCancel={() => { touchStart.current = null }} onKeyDown={handleKeyDown}>
    <div className="community-gallery-review__top"><h2>사진 후기</h2><span aria-live="polite">{index + 1} / {total}</span></div>
    <div className="community-gallery-review__image"><PhotoContent photo={photo} /></div>
    <article className="community-gallery-review__text">
      <div className="community-gallery-review__meta"><strong>{nickname}</strong>{kind === 'mountain' && rating != null && <span>★ {rating.toFixed(1)}</span>}<time dateTime={photo.review?.createdAt}>{date}</time></div>
      <p>{content}</p>
    </article>
  </section>
}
