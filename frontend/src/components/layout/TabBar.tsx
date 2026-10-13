import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Tab } from "./Tab";
import "../common/controls.css";
import "./navigation.css";

export type TabItem = { value: string; label: string; controls?: string };
export type TabBarProps = {
  items?: readonly TabItem[];
  children?: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: "fixed" | "scrollable" | "segmented";
  "aria-label"?: string;
  className?: string;
};

export function TabBar({
  items, children, value, defaultValue, onValueChange, variant = "fixed",
  "aria-label": ariaLabel = "탭", className,
}: TabBarProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? items?.[0]?.value);
  const activeValue = value ?? internalValue;

  function choose(next: string) {
    if (value === undefined) setInternalValue(next);
    onValueChange?.(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!items?.length) return;
    const current = items.findIndex(item => item.value === activeValue);
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    choose(items[next].value);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  return <div role="tablist" aria-label={ariaLabel} onKeyDown={handleKeyDown}
    className={["af-tab-bar", `af-tab-bar--${variant}`, className].filter(Boolean).join(" ")}>
    {children ?? items?.map(item => <Tab key={item.value} label={item.label}
      selected={item.value === activeValue}
      tabIndex={item.value === activeValue ? 0 : -1}
      variant={variant === "segmented" ? "segmented" : "underline"}
      controls={item.controls} onClick={() => choose(item.value)} />)}
  </div>;
}
