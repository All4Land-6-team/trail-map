import type { MouseEventHandler } from 'react'
import { Icon } from '../common/Icon'
import type { CommunityReview, ReviewKind } from '../../types/community'

type ReviewCardProps = { type: ReviewKind; review: CommunityReview; onClick: MouseEventHandler<HTMLButtonElement> }

const dateLabel = (createdAt: string) => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(createdAt))

function Rating({ review, type }: Pick<ReviewCardProps, 'review' | 'type'>) {
  if (type !== 'course') return null
  const rating = review.rating == null ? 0 : Math.max(0, Math.min(5, Math.round(review.rating)))
  return <span className="community-review-card__rating" aria-label={review.rating == null ? '평점 없음' : `별점 ${review.rating.toFixed(1)}점`}>
    <span aria-hidden="true">{'★'.repeat(rating)}<span className="community-review-card__rating-empty">{'☆'.repeat(5 - rating)}</span></span>
    {review.rating != null && <> {review.rating.toFixed(1)}</>}
  </span>
}

export function ReviewCard({ type, review, onClick }: ReviewCardProps) {
  const photo = review.photos[0]
  return <button type="button" className={`community-review-card community-review-card--${type}`} role="listitem" onClick={onClick}>
    {photo ? <span className="community-review-card__photo"><img src={photo} alt="" loading="lazy" /></span>
      : <span className="community-review-card__photo community-review-card__photo--placeholder"><Icon name="Photo" size={28} color="currentColor" /></span>}
    <span className="community-review-card__body">
      <Rating review={review} type={type} />
      <span className="community-review-card__meta"><strong>{review.author ?? '나'}</strong><span aria-hidden="true">·</span><time dateTime={review.createdAt}>{dateLabel(review.createdAt)}</time></span>
      <span className="community-review-card__content">{review.content}</span>
    </span>
  </button>
}

export function EmptyReviewCard({ type }: { type: ReviewKind }) {
  return <div className={`community-review-card community-review-card--empty community-review-card--${type}`} role="listitem">
    <span className="community-review-card__photo community-review-card__photo--placeholder"><Icon name="Photo" size={28} color="currentColor" /></span>
    <span className="community-review-card__body">
      <span className="community-review-card__empty-text">아직 등록된 후기가 없어요.</span>
    </span>
  </div>
}

export function MoreReviewsCard({ type, onClick }: { type: ReviewKind; onClick: () => void }) {
  const label = type === 'mountain' ? '산' : type === 'course' ? '코스' : '스팟'
  return <button type="button" className={`community-review-more-card community-review-more-card--${type}`} role="listitem" onClick={onClick}>
    <span>{label} 후기<br />더보기</span>
  </button>
}
