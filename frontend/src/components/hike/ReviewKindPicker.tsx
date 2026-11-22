import { useEffect, useState } from "react";
import { fetchHikeRecordReviews, type HikeRecordReviews } from "../../api/hikeRecordApi";
import { navigate } from "../../hooks/useHashRoute";
import { Icon } from "../common/Icon";
import "./ReviewKindPicker.css";

export type RecordReviewKind = "mountain" | "course" | "spot";

/** 후기 유형 선택 순서: 산 후기 → 코스 후기 → 스팟 후기 */
const REVIEW_CHOICES: { kind: RecordReviewKind; label: string }[] = [
  { kind: "mountain", label: "산 후기" },
  { kind: "course", label: "코스 후기" },
  { kind: "spot", label: "스팟 후기" },
];

/** 이 등산 기록으로 작성한 후기. 기록 번호가 없으면(예시 데이터) 부르지 않는다. */
export function useRecordReviews(hikeRecordId: number | undefined) {
  const [reviews, setReviews] = useState<{ id: number; data?: HikeRecordReviews; failed?: boolean }>();
  useEffect(() => {
    if (hikeRecordId === undefined) return;
    let cancelled = false;
    fetchHikeRecordReviews(hikeRecordId)
      .then(data => { if (!cancelled) setReviews({ id: hikeRecordId, data }); })
      .catch(() => { if (!cancelled) setReviews({ id: hikeRecordId, failed: true }); });
    return () => { cancelled = true; };
  }, [hikeRecordId]);
  return reviews?.id === hikeRecordId ? reviews : undefined;
}

/** 고른 후기 종류로 커뮤니티의 기존 후기 작성 흐름을 연다. 작성을 마치거나 나가면 returnTo로 돌아온다. */
export function openReviewWriting(kind: RecordReviewKind, mountainId: string | undefined, returnTo: string) {
  const query = new URLSearchParams({ screen: "map", review: kind, returnTo });
  if (mountainId) query.set("mountain", mountainId);
  navigate(`community?${query}`);
}

export type ReviewKindPickerProps = {
  /** 산·코스 후기는 기록마다 하나라 이미 썼으면 막는다. */
  reviewed?: { mountain: boolean; course: boolean };
  onSelect: (kind: RecordReviewKind) => void;
  onClose: () => void;
};

/** "어떤 후기를 남길까요?" 후기 유형 선택 창 (등산 완료 HIKE-08 · 등산 기록 상세 REC-03) */
export function ReviewKindPicker({ reviewed, onSelect, onClose }: ReviewKindPickerProps) {
  const done = (kind: RecordReviewKind) => kind !== "spot" && (reviewed?.[kind] ?? false);
  return <div className="af-review-kind-picker"
    onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="af-review-kind-picker__dialog" role="dialog" aria-modal="true" aria-labelledby="af-review-kind-picker-title"
      onKeyDown={event => { if (event.key === "Escape") onClose(); }}>
      <h2 id="af-review-kind-picker-title">어떤 후기를 남길까요?</h2>
      <p>후기 유형을 선택해 주세요.</p>
      {REVIEW_CHOICES.map(choice => <button type="button" key={choice.kind} disabled={done(choice.kind)}
        onClick={() => onSelect(choice.kind)}>
        {choice.label}
        {done(choice.kind) ? <span className="af-review-kind-picker__done">작성 완료</span> : <Icon name="ChevronRight" size={18} />}
      </button>)}
      <button type="button" className="af-review-kind-picker__cancel" onClick={onClose}>취소</button>
    </section>
  </div>;
}
