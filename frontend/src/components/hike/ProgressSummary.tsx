import "../common/controls.css";
import "./hike.css";

export type ProgressSummaryProps = {
  stage?: "ascent" | "descent";
  traveledDistance?: number;
  remainingDistance?: number;
  sunset?: string;
  progress?: number;
  className?: string;
};

export function ProgressSummary({
  stage = "ascent", traveledDistance = 2, remainingDistance = 2.2,
  sunset = "18:30", progress, className,
}: ProgressSummaryProps) {
  const fraction = Math.max(0, Math.min(1, progress ?? (stage === "descent" ? .635 : .48)));
  return <section className={["af-progress-summary", className].filter(Boolean).join(" ")}
    aria-label="산행 진행 상황">
    <h2>{stage === "descent" ? "내려가는 중" : "올라가는 중"}</h2>
    <div className="af-progress-summary__distances"><span>이동 {traveledDistance.toFixed(1)} km</span><span>남은 {remainingDistance.toFixed(1)} km</span></div>
    <div className="af-progress-summary__track" role="progressbar" aria-label="산행 진행률"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}>
      <span style={{ width: `${fraction * 100}%` }} />
    </div>
    <p>일몰 {sunset}</p>
  </section>;
}
