import { Icon, type IconName } from "../common/Icon";
import { Typography } from "../common/Typography";
import "../common/controls.css";
import "./navigation.css";

export type BottomDestination = "home" | "community" | "saved" | "myHikes";
export type BottomNavigationProps = {
  active?: BottomDestination;
  onNavigate?: (destination: BottomDestination) => void;
  className?: string;
};

const destinations: readonly { id: BottomDestination; label: string; icon: IconName }[] = [
  { id: "home", label: "홈", icon: "Home" },
  { id: "community", label: "커뮤니티", icon: "Community" },
  { id: "saved", label: "등산 담기", icon: "Bag" },
  { id: "myHikes", label: "내 등산", icon: "Calendar" },
];

export function BottomNavigation({
  active = "home", onNavigate, className,
}: BottomNavigationProps) {
  return <nav aria-label="하단 내비게이션"
    className={["af-bottom-nav", `af-bottom-nav--${active}`, className].filter(Boolean).join(" ")}>
    {destinations.map(({ id, label, icon }) => <button
      key={id} type="button" aria-current={active === id ? "page" : undefined}
      aria-label={label} onClick={() => onNavigate?.(id)}
      className="af-bottom-nav__item">
      <Icon name={icon} size={22} color="currentColor" />
      <Typography variant="navigationLabel" className="af-bottom-nav__label">{label}</Typography>
    </button>)}
  </nav>;
}
