import { useEffect, useRef, useState } from 'react'
import type { CommunityReview, ReviewKind } from '../../types/community'
import { EmptyReviewCard, MoreReviewsCard, ReviewCard } from './ReviewCarouselCards'
import './review-carousel.css'

type ReviewCarouselProps = {
  type: ReviewKind
  reviews: readonly CommunityReview[]
  onReviewClick: (review: CommunityReview) => void
  onViewAll: () => void
  limit?: number
}

const typeLabels: Record<ReviewKind, string> = { mountain: '산', course: '코스', spot: '스팟' }

export function ReviewCarousel({ type, reviews, onReviewClick, onViewAll, limit = 4 }: ReviewCarouselProps) {
  const visibleReviews = reviews.slice(0, limit)
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const trackItemCount = visibleReviews.length + 1
  const paginationCount = Math.max(1, visibleReviews.length)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const updateIndex = () => {
      const items = Array.from(track.children) as HTMLElement[]
      if (items.length === 0) return
      const index = items.reduce((closest, item, itemIndex) => {
        const currentDistance = Math.abs(item.offsetLeft - track.scrollLeft)
        const closestDistance = Math.abs(items[closest].offsetLeft - track.scrollLeft)
        return currentDistance < closestDistance ? itemIndex : closest
      }, 0)
      setActiveIndex(Math.min(index, Math.max(0, paginationCount - 1)))
    }
    track.addEventListener('scroll', updateIndex, { passive: true })
    updateIndex()
    return () => track.removeEventListener('scroll', updateIndex)
  }, [trackItemCount, paginationCount])

  const moveTo = (index: number) => {
    const item = trackRef.current?.children[index] as HTMLElement | undefined
    item?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }

  return <section className="community-review-carousel" aria-label={`${typeLabels[type]} 후기 미리보기`}>
    <div ref={trackRef} className="community-review-carousel__track" role="list">
      {visibleReviews.length === 0
        ? <><EmptyReviewCard type={type} /><MoreReviewsCard type={type} onClick={onViewAll} /></>
        : <>{visibleReviews.map(review => <ReviewCard key={review.id} type={type} review={review} onClick={() => onReviewClick(review)} />)}
          <MoreReviewsCard type={type} onClick={onViewAll} /></>}
    </div>
    {paginationCount > 0 && <div className="community-review-carousel__pagination" role="group" aria-label={`${typeLabels[type]} 후기 카드 선택`}>
      {Array.from({ length: paginationCount }, (_, index) => <button key={index} type="button" className={index === activeIndex ? 'is-active' : ''}
        aria-label={`${index + 1}번째 ${typeLabels[type]} 후기`} aria-current={index === activeIndex ? 'true' : undefined}
        onClick={() => moveTo(index)} />)}
    </div>}
  </section>
}
