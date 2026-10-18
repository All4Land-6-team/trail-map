import { useState, type FormEvent } from "react";
import { Button } from "../../../components/common/Button";
import { Field } from "../../../components/common/Field";
import { DEFAULT_NICKNAME, NICKNAME_MAX_LENGTH, saveNickname, useNickname } from "../../../store/profileStore";

/** HIKE-01 닉네임: 산 · 코스 · 스팟 후기 작성자 이름. 기본값은 익명이고 중복은 검사하지 않는다. */
export function NicknameCard() {
  const nickname = useNickname();
  const [draft, setDraft] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (draft === null) return;
    saveNickname(draft);
    setDraft(null);
  };

  if (draft === null) return <section className="hike-nickname-card" aria-label="닉네임">
    <div className="hike-nickname-card__copy">
      <span className="hike-nickname-card__label">닉네임</span>
      <strong className="hike-nickname-card__name">{nickname}</strong>
    </div>
    <Button variant="secondary" size="compact" label="이름 바꾸기"
      onClick={() => setDraft(nickname === DEFAULT_NICKNAME ? "" : nickname)} />
  </section>;

  return <form className="hike-nickname-card hike-nickname-card--editing" aria-label="닉네임 수정" onSubmit={submit}
    onKeyDown={(event) => { if (event.key === "Escape") setDraft(null); }}>
    <Field label="닉네임" showIcon={false} showHelper placeholder={DEFAULT_NICKNAME} autoFocus
      helper={`후기 작성자 이름으로 보여요. 비워 두면 ${DEFAULT_NICKNAME}으로 저장돼요.`}
      maxLength={NICKNAME_MAX_LENGTH} value={draft} onChange={(event) => setDraft(event.target.value)}
      containerClassName="hike-nickname-card__field" />
    <div className="hike-nickname-card__actions">
      <Button variant="secondary" size="compact" label="취소" onClick={() => setDraft(null)} />
      <Button type="submit" size="compact" label="저장" />
    </div>
  </form>;
}
