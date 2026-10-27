import { useEffect, useState, type FormEvent } from "react";
import {
  DEFAULT_NICKNAME,
  NICKNAME_MAX_LENGTH,
  fetchUserProfile,
  updateUserNickname,
} from "../../../api/profile";
import { Button } from "../../../components/common/Button";
import { Field } from "../../../components/common/Field";

/** HIKE-01 닉네임: 산 · 코스 · 스팟 후기 작성자 이름. 기본값은 익명{userId}이고 중복은 검사하지 않는다. */
export function NicknameCard() {
  const [nickname, setNickname] = useState(DEFAULT_NICKNAME);
  const [draft, setDraft] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchUserProfile()
      .then(profile => { if (!cancelled) setNickname(profile.nickname); })
      .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "닉네임을 불러오지 못했어요."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (draft === null || saving) return;
    setSaving(true);
    setError("");
    try {
      const profile = await updateUserNickname(draft);
      setNickname(profile.nickname);
      setDraft(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "닉네임을 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  if (draft === null) return <section className="hike-nickname-card" aria-label="닉네임">
    <div className="hike-nickname-card__copy">
      <span className="hike-nickname-card__label">닉네임</span>
      <strong className="hike-nickname-card__name">{loading ? "불러오는 중..." : nickname}</strong>
      {error && <span className="hike-nickname-card__error" role="alert">{error}</span>}
    </div>
    <Button variant="secondary" size="compact" label="이름 바꾸기"
      disabled={loading}
      onClick={() => setDraft(nickname === DEFAULT_NICKNAME ? "" : nickname)} />
  </section>;

  return <form className="hike-nickname-card hike-nickname-card--editing" aria-label="닉네임 수정" onSubmit={submit}
    onKeyDown={(event) => { if (event.key === "Escape") setDraft(null); }}>
    <Field label="닉네임" showIcon={false} placeholder={DEFAULT_NICKNAME} autoFocus
      maxLength={NICKNAME_MAX_LENGTH} value={draft} onChange={(event) => setDraft(event.target.value)} />
    <div className="hike-nickname-card__actions">
      <Button variant="secondary" size="compact" label="취소" disabled={saving} onClick={() => setDraft(null)} />
      <Button type="submit" size="compact" label={saving ? "저장 중" : "저장"} disabled={saving} />
    </div>
    {error && <p className="hike-nickname-card__error" role="alert">{error}</p>}
  </form>;
}
