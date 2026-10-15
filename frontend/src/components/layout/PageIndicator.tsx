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
};

export function PageIndicator({ count, activeIndex, className, ...rest }: PageIndicatorProps) {
  const dotCount = Math.max(0, Math.floor(count));
  const visiblePage = dotCount ? Math.min(Math.max(activeIndex, 0), dotCount - 1) + 1 : 0;
  return <div {...rest} role="img" aria-label={`페이지 ${visiblePage} / ${dotCount}`}
    className={["af-page-indicator", className].filter(Boolean).join(" ")}>
    {Array.from({ length: dotCount }, (_, index) => <PageDot key={index} selected={index === activeIndex} />)}
  </div>;
}
