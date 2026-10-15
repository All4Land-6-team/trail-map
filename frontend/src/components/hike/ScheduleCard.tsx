import type { HTMLAttributes } from "react";
import "../common/controls.css";
import "./hike.css";

export type ScheduleCardProps = HTMLAttributes<HTMLElement> & {
  time: string;
  course: string;
  distance: string;
};

export function ScheduleCard({ time, course, distance, className, ...rest }: ScheduleCardProps) {
  return <article {...rest} className={["af-schedule-card", className].filter(Boolean).join(" ")}>
    <time className="af-schedule-card__time">{time}</time>
    <h3 className="af-schedule-card__course">{course}</h3>
    <p className="af-schedule-card__distance">{distance}</p>
  </article>;
}
