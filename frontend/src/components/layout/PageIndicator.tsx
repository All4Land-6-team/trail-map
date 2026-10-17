import type { HTMLAttributes } from "react";
import "../common/controls.css";
import "./navigation.css";

export type PageDotProps = HTMLAttributes<HTMLSpanElement> & { selected?: boolean };

export function PageDot({ selected = false, className, ...rest }: PageDotProps) {
  return <span {...rest} aria-hidden="true"
    className={["af-page-dot", selected && "af-page-dot--selected", className].filter(Boolean).join(" ")} />;
}

export type PageIndicatorProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  count: number;
  activeIndex: number;
  onPageChange?: (index: number) => void;
};

export function PageIndicator({ count, activeIndex, onPageChange, className, ...rest }: PageIndicatorProps) {
  const dotCount = Math.max(0, Math.floor(count));
  const visiblePage = dotCount ? Math.min(Math.max(activeIndex, 0), dotCount - 1) + 1 : 0;
  return <div {...rest} role={onPageChange ? "group" : "img"} aria-label={`페이지 ${visiblePage} / ${dotCount}`}
    className={["af-page-indicator", className].filter(Boolean).join(" ")}>
    {Array.from({ length: dotCount }, (_, index) => onPageChange
      ? <button key={index} type="button" className="af-page-indicator__button"
        aria-label={`${index + 1}번째 코스 선택`} aria-pressed={index === activeIndex} onClick={() => onPageChange(index)}>
        <PageDot selected={index === activeIndex} />
      </button>
      : <PageDot key={index} selected={index === activeIndex} />)}
  </div>;
}
