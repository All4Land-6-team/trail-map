import "./HikeFloatingUI.css";

export type HikeFloatingControlsProps = {
  state: "start" | "recording" | "paused";
  busy?: boolean;
  showMain?: boolean;
  mainLabel?: string;
  secondaryLabel?: string;
  /** 보조 버튼 오른쪽에 두는 종료 버튼 (빨간 글씨) */
  endLabel?: string;
  onMain: () => void;
  onSecondary?: () => void;
  onEnd?: () => void;
};

export function HikeFloatingControls({ state, busy = false, showMain = true, mainLabel, secondaryLabel, endLabel, onMain, onSecondary, onEnd }: HikeFloatingControlsProps) {
  const playing = state === "start" || state === "paused";
  const label = mainLabel ?? (state === "start" ? "등산 시작" : state === "paused" ? "기록 재개" : "일시정지");
  return <div className={["af-hike-controls", !showMain && "af-hike-controls--secondary-only"].filter(Boolean).join(" ")}
    aria-label="등산 기록 조작">
    {showMain && <div className="af-hike-control__main">
      {state === "start"
        ? <button type="button" className="af-hike-control__start" disabled={busy} onClick={onMain} aria-label={label}>
          <span className="af-hike-control__start-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="m5 17 4.3-6 2.5 3.2 2.6-4.2 4.6 7H5Zm7-10.7 1.8 1.8L12 9.9 10.2 8.1 12 6.3Z" /></svg>
          </span>
          <span>{label}</span>
        </button>
        : <button type="button" className="af-hike-control__circle" disabled={busy} onClick={onMain} aria-label={label}>
          <svg viewBox="0 0 32 32" aria-hidden="true">
            {playing
              ? <path d="M11 8.5v15l13-7.5-13-7.5Z" />
              : <><rect x="9" y="8" width="5" height="16" rx="1.5" /><rect x="18" y="8" width="5" height="16" rx="1.5" /></>}
          </svg>
        </button>}
      <span>{label}</span>
    </div>}
    {secondaryLabel && onSecondary && <button type="button" className="af-hike-control__secondary" disabled={busy}
      onClick={onSecondary}>{secondaryLabel}</button>}
    {endLabel && onEnd && <button type="button" className="af-hike-control__secondary af-hike-control__secondary--end" disabled={busy}
      onClick={onEnd}>{endLabel}</button>}
  </div>;
}
