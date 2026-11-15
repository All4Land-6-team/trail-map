import type { SunTimesView } from "../../hooks/useSunTimes";
import { Icon } from "../common/Icon";
import "./HikeFloatingUI.css";

export function HikeSunsetNotice({ sun }: { sun: SunTimesView }) {
  if (sun.phase !== "sunset-soon" && sun.phase !== "after-sunset") return null;
  return <p className={`af-hike-sunset-notice af-hike-sunset-notice--${sun.phase}`} role="status">
    <Icon name="Sun" size={18} />
    {sun.phase === "sunset-soon" ? `${sun.message} · 하산 시간을 확인해 주세요` : "일몰이 지났어요 · 주변을 확인하며 이동해 주세요"}
  </p>;
}
