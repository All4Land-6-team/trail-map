import { useLayoutEffect, useId, useRef, useState } from "react";
import type { SunTimesView } from "../../hooks/useSunTimes";
import "./SunArc.css";

export type SunArcProps = {
  sun: SunTimesView;
  variant?: "expanded" | "compact";
  className?: string;
};

const ARC_PATH = "M 76 126 A 110 110 0 0 1 284 126";
type SunPoint = { x: number; y: number };

/** 현재 시각을 일출~일몰의 넓은 빛 궤적 위에 표현하는 공통 등산 HUD. */
export function SunArc({ sun, variant = "expanded", className }: SunArcProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const [sunPoint, setSunPoint] = useState<SunPoint | null>(null);
  const progressLength = Math.round(sun.progress * 1000) / 10;
  const id = useId().replaceAll(":", "");
  const elapsedGradientId = `sun-arc-elapsed-${id}`;
  const sunDiscId = `sun-disc-${id}`;
  const sunGlowId = `sun-glow-${id}`;
  const pathGlowId = `sun-path-glow-${id}`;

  useLayoutEffect(() => {
    const path = pathRef.current;
    if (!path || !sun.available) return;
    const point = path.getPointAtLength(path.getTotalLength() * sun.progress);
    setSunPoint({ x: point.x, y: point.y });
  }, [sun.available, sun.progress]);

  return <section className={["af-sun-arc", `af-sun-arc--${variant}`, `af-sun-arc--${sun.phase}`, className].filter(Boolean).join(" ")}
    aria-label="오늘의 일출과 일몰">
    <svg className="af-sun-arc__graphic" viewBox="0 -5 360 165" role="img"
      aria-label={sun.available ? `${sun.message}. 현재 시각 ${sun.currentLabel}` : sun.message}>
      <defs>
        <linearGradient id={elapsedGradientId} x1="0" y1="160" x2="360" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffb875" />
          <stop offset="0.45" stopColor="#ffd78f" />
          <stop offset="0.72" stopColor="#fff3b5" />
          <stop offset="1" stopColor="#ffd27f" />
        </linearGradient>
        <radialGradient id={sunDiscId} cx="42%" cy="38%" r="62%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.34" stopColor="#fffbe6" />
          <stop offset="0.72" stopColor="#ffd779" />
          <stop offset="1" stopColor="#efb24a" />
        </radialGradient>
        <radialGradient id={sunGlowId}>
          <stop offset="0" stopColor="#ffffff" stopOpacity=".78" />
          <stop offset="0.42" stopColor="#fff2bd" stopOpacity=".46" />
          <stop offset="0.72" stopColor="#ffd170" stopOpacity=".2" />
          <stop offset="1" stopColor="#ffc95e" stopOpacity="0" />
        </radialGradient>
        <filter id={pathGlowId} x="-25%" y="-35%" width="150%" height="180%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <path className="af-sun-arc__halo" d={ARC_PATH} filter={`url(#${pathGlowId})`} />
      <path ref={pathRef} className="af-sun-arc__track" pathLength="100" d={ARC_PATH} />
      {sun.available && <>
        <path className="af-sun-arc__elapsed" pathLength="100" strokeDasharray={`${progressLength} 100`}
          d={ARC_PATH} stroke={`url(#${elapsedGradientId})`} />
        {sunPoint && <g className="af-sun-arc__sun" style={{ transform: `translate(${sunPoint.x}px, ${sunPoint.y}px)` }} aria-hidden="true">
          <circle className="af-sun-arc__glow" r="31" fill={`url(#${sunGlowId})`} />
          <circle className="af-sun-arc__disc" r="12" fill={`url(#${sunDiscId})`} />
        </g>}
      </>}
    </svg>
    <div className="af-sun-arc__times" aria-hidden={!sun.available}>
      <span><small>일출</small><strong>{sun.sunriseLabel ?? "--:--"}</strong></span>
      <span className="af-sun-arc__now"><small>현재 {sun.currentLabel}</small><strong>{sun.message}</strong></span>
      <span><small>일몰</small><strong>{sun.sunsetLabel ?? "--:--"}</strong></span>
    </div>
  </section>;
}
