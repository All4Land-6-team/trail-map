import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { IconToggle } from "../common/IconToggle";
import "../common/controls.css";
import "./content.css";

export type CourseCardProps = {
  title: string;
  route: string;
  difficulty: string;
  controlStatus: string;
  distance: string;
  duration: string;
  elevationGain: string;
  peakElevation: string;
  saved?: boolean;
  scheduled?: boolean;
  onSavedChange?: (selected: boolean) => void;
  onScheduledChange?: (selected: boolean) => void;
  onOpen?: () => void;
  className?: string;
};

export function CourseCard({
  title, route, difficulty, controlStatus, distance, duration,
  elevationGain, peakElevation, saved, scheduled,
  onSavedChange, onScheduledChange, onOpen, className,
}: CourseCardProps) {
  const metrics = [
    { label: "거리", value: distance },
    { label: "소요 시간", value: duration },
    { label: "상승 고도", value: elevationGain },
    { label: "최고 고도", value: peakElevation },
  ];
  return <article className={["af-course-card", className].filter(Boolean).join(" ")}>
    <div className="af-course-card__heading">
      <h3 className="af-course-card__title">{title}</h3>
      <div className="af-course-card__actions">
        <IconToggle icon="save" selected={saved} onSelectedChange={onSavedChange} />
        <IconToggle icon="schedule" selected={scheduled} onSelectedChange={onScheduledChange} />
      </div>
    </div>
    <p className="af-course-card__route">{route}</p>
    <div className="af-course-card__badges"><Badge>{difficulty}</Badge><Badge>{controlStatus}</Badge></div>
    <div className="af-course-card__stats">
      {metrics.map(metric => <div className="af-course-card__metric" key={metric.label}>
        <span className="af-course-card__metric-value">{metric.value}</span>
        <span className="af-course-card__metric-label">{metric.label}</span>
      </div>)}
    </div>
    <div className="af-course-card__footer"><Button size="compact" onClick={onOpen}>코스 상세 보기</Button></div>
  </article>;
}
