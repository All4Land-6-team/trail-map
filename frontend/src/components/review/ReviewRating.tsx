import './review-rating.css'

export function ReviewRating({ value }: { value: number }) {
  return <span className="review-rating" aria-label={`별점 ${value.toFixed(1)}점`}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.7 2.85 5.78 6.38.93-4.62 4.5 1.09 6.36L12 17.28l-5.7 3 1.09-6.36-4.62-4.5 6.38-.93L12 2.7Z" /></svg>
    <span>{value.toFixed(1)}</span>
  </span>
}
