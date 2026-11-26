import type { MouseEventHandler } from 'react'
import { Icon } from '../common/Icon'
import type { CommunityReview, ReviewKind } from '../../types/community'
import { ReviewEnvironmentBadge } from './ReviewEnvironmentBadge'
import { ReviewRating } from './ReviewRating'

type ReviewCardProps = { type: ReviewKind; review: CommunityReview; onClick: MouseEventHandler<HTMLButtonElement> }

const dateLabel = (createdAt: string) => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(createdAt))

export function ReviewCard({ type, review, onClick }: ReviewCardProps) {
  const photo = review.photos[0]
  return <article className={`community-review-card community-review-card--${type}`} role="listitem">
    <button type="button" className="community-review-card__open" aria-label={`${review.author ?? '나'}의 후기 상세 보기`} onClick={onClick} />
    {photo ? <span className="community-review-card__photo"><img src={photo} alt="" loading="lazy" /></span>
      : <span className="community-review-card__photo community-review-card__photo--placeholder"><Icon name="Photo" size={28} color="currentColor" /></span>}
    <span className="community-review-card__body">
      <span className="community-review-card__record"><time dateTime={review.createdAt}>{dateLabel(review.createdAt)}</time>
        <span className="community-review-card__weather"><ReviewEnvironmentBadge environment={review.environment} compact /></span></span>
      <span className="community-review-card__author-row"><strong>{review.author ?? '나'}</strong>
        {type === 'course' && review.rating != null && <span className="community-review-card__rating"><ReviewRating value={review.rating} /></span>}</span>
      <span className="community-review-card__content">{review.content}</span>
    </span>
  </article>
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
