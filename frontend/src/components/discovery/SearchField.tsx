import type { InputHTMLAttributes } from "react";
import { Icon } from "../common/Icon";
import "../common/controls.css";
import "./discovery.css";

export type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  onSearch?: (query: string) => void;
  showLeadingIcon?: boolean;
};

export function SearchField({
  className, defaultValue, onSearch, showLeadingIcon = true, placeholder = "어느 산으로 떠날까요?", value, ...rest
}: SearchFieldProps) {
  return <div className={["af-search-field", className].filter(Boolean).join(" ")}>
    {showLeadingIcon && <Icon name="Mountain" size={24} />}
    <input {...rest} className="af-search-field__input" type="search" aria-label={rest["aria-label"] ?? "산 검색"}
      placeholder={placeholder} defaultValue={defaultValue} value={value}
      onKeyDown={(event) => {
        rest.onKeyDown?.(event);
        if (event.key === "Enter" && !event.nativeEvent.isComposing && !event.defaultPrevented) onSearch?.(event.currentTarget.value);
      }} />
    <button type="button" className="af-search-field__action" aria-label="검색"
      onClick={(event) => onSearch?.(event.currentTarget.parentElement?.querySelector("input")?.value ?? "")}>
      <Icon name="Search" size={24} />
    </button>
  </div>;
}
