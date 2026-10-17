import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "../common/Icon";
import { Typography } from "../common/Typography";
import "../common/controls.css";
import "./hike.css";

type Period = "오전" | "오후";

export type TimeSelectFieldProps = {
  label: string;
  /** HH:mm, 비어 있으면 미선택 */
  value: string;
  onChange: (value: string) => void;
  /** 분 단위 (기본 10분 → 00·10·20·30·40·50) */
  minuteStep?: number;
  error?: boolean;
  "aria-describedby"?: string;
};

const periods: readonly Period[] = ["오전", "오후"];
const hours12 = Array.from({ length: 12 }, (_, index) => index + 1);

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parse(value: string) {
  if (!value) return null;
  const [hour24, minute] = value.split(":").map(Number);
  return { period: (hour24 < 12 ? "오전" : "오후") as Period, hour: hour24 % 12 || 12, minute };
}

function toValue(period: Period, hour: number, minute: number) {
  const hour24 = (hour % 12) + (period === "오후" ? 12 : 0);
  return `${pad(hour24)}:${pad(minute)}`;
}

/**
 * 등산 시작 시간 입력 칸. 공용 Field와 같은 모양이고, 누르면 오전·오후 | 시 | 분 목록이 열린다.
 * 브라우저 기본 시간 선택 창은 분 목록을 10분 단위로 줄일 수 없어 직접 그린다.
 */
export function TimeSelectField({ label, value, onChange, minuteStep = 10, error = false, ...rest }: TimeSelectFieldProps) {
  const labelId = useId();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parse(value);
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, index) => index * minuteStep);
  // 아직 고르지 않은 칸은 오전 9시를 기준으로 시작한다.
  const base = selected ?? { period: "오전" as Period, hour: 9, minute: 0 };

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return <div ref={rootRef} className={["af-field", "af-time-select", error && "af-field--error"].filter(Boolean).join(" ")}>
    <Typography as="span" id={labelId} variant="controlLabel" className="af-field__label">{label}</Typography>
    <button ref={triggerRef} type="button" className="af-field__box af-time-select__trigger"
      aria-labelledby={labelId} aria-haspopup="dialog" aria-expanded={open} aria-controls={panelId}
      aria-invalid={error || undefined} aria-describedby={rest["aria-describedby"]} onClick={() => setOpen(!open)}>
      <span className={["af-field__input", "af-time-select__value", !selected && "af-time-select__value--empty"].filter(Boolean).join(" ")}>
        {selected ? `${selected.period} ${pad(selected.hour)}:${pad(selected.minute)}` : "--:--"}
      </span>
      <span className="af-field__icon" aria-hidden="true"><Icon name="Clock" size={20} color="#83978a" /></span>
    </button>
    {open && <div id={panelId} role="dialog" aria-label={`${label} 선택`} className="af-time-select__panel"
      onKeyDown={event => {
        if (event.key !== "Escape") return;
        // 시트까지 닫히지 않도록 선택 창만 닫는다.
        event.stopPropagation();
        close();
      }}>
      <div className="af-time-select__column" role="group" aria-label="오전 오후">
        {periods.map(period => <button key={period} type="button" className="af-time-select__option"
          aria-pressed={selected?.period === period} onClick={() => onChange(toValue(period, base.hour, base.minute))}>{period}</button>)}
      </div>
      <div className="af-time-select__column" role="group" aria-label="시">
        {hours12.map(hour => <button key={hour} type="button" className="af-time-select__option"
          aria-pressed={selected?.hour === hour} onClick={() => onChange(toValue(base.period, hour, base.minute))}>{pad(hour)}</button>)}
      </div>
      <div className="af-time-select__column" role="group" aria-label="분">
        {minutes.map(minute => <button key={minute} type="button" className="af-time-select__option"
          aria-pressed={selected?.minute === minute} onClick={() => {
            onChange(toValue(base.period, base.hour, minute));
            close();
          }}>{pad(minute)}</button>)}
      </div>
    </div>}
  </div>;
}
