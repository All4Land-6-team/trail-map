import "../common/controls.css";
import "./review.css";

export type RatingInputProps = {
  value: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
};

export function RatingInput({ value, onChange, disabled = false, className, label = "후기 별점" }: RatingInputProps) {
  const rating = Math.max(0, Math.min(5, Math.round(value)));
  return <div role="group" aria-label={label} className={["af-rating-input", className].filter(Boolean).join(" ")}>
    {Array.from({ length: 5 }, (_, index) => {
      const star = index + 1;
      return <button key={star} type="button" className="af-rating-input__star"
        aria-label={`${star}점`} aria-pressed={rating === star} disabled={disabled}
        onClick={() => onChange?.(rating === star ? 0 : star)}>{star <= rating ? "★" : "☆"}</button>;
    })}
  </div>;
}
