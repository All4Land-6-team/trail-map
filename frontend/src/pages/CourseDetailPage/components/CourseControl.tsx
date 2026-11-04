import { useState } from 'react';
import type { ParkControlState, ControlAsset } from '../../../types/parkControl';

function time(value: string | null) {
  return value ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '확인 전';
}
function ControlImage({ asset, onFailure }: { asset: ControlAsset; onFailure: () => void }) {
  const [failed, setFailed] = useState(false);
  return <figure className="course-control__image">
    {asset.imageUrl && !failed ? <a href={asset.imageUrl} target="_blank" rel="noopener noreferrer" aria-label={`${asset.name} 크게 보기 (새 창)`}>
      <img src={asset.imageUrl} alt={asset.name} loading="lazy" onError={() => { setFailed(true); onFailure(); }} /><span>이미지 크게 보기 ↗</span>
    </a> : <p>이미지를 불러오지 못했어요. <a href={asset.sourceUrl} target="_blank" rel="noopener noreferrer">공단 첨부 보기 ↗</a></p>}
  </figure>;
}
type Props = {
  state: ParkControlState;
  expanded: boolean;
  setExpanded: (open: boolean) => void;
  renewImages: () => void;
};
export function CourseControl({ state, expanded, setExpanded, renewImages }: Props) {
  if (state.status === 'loading') return <p role="status">통제정보를 불러오는 중이에요.</p>;
  if (state.status === 'error') return <div className="course-spots__status"><p role="alert">{state.message}</p></div>;
  if (state.status === 'unavailable' || (state.status === 'success' && state.data.availability !== 'AVAILABLE')) return <div className="course-spots__status">
    <p role="status">{state.status === 'success' && state.data.availability === 'MISSING'
      ? '담당 사무소의 통제정보를 아직 수집하지 않았어요.' : '이 코스는 사무소 통제정보를 지원하지 않아요.'}</p>
    <a href="https://www.knps.or.kr/front/portal/safe/acsCtrList.do?menuNo=8000340" target="_blank" rel="noopener noreferrer">공단 통제정보 확인 ↗</a>
  </div>;
  if (state.status !== 'success' || !state.data.office) return null;
  const o = state.data.office;
  const uncertain = o.stale || o.collectionState === 'ERROR' || o.collectionState === 'MISSING' || o.status === 'UNKNOWN';
  const restricted = o.status === 'PARTIAL' || o.status === 'CLOSED';
  const label = { NORMAL: '정상', PARTIAL: '부분통제', CLOSED: '전면통제', UNKNOWN: '확인 전' }[o.status];
  const inline = o.assets.filter(a => a.kind === 'INLINE');
  const attachments = o.assets.filter(a => a.kind === 'ATTACHMENT');
  const previews = inline.length ? inline : attachments.filter(asset => asset.imageUrl);
  return <article className="course-control" aria-label={`${o.name} 통제정보`}>
    <header><span className={`course-control__badge ${restricted ? 'is-restricted' : uncertain ? 'is-unknown' : ''}`}>{uncertain ? `마지막 확인: ${label}` : label}</span><h3>{o.name}</h3></header>
    <div className="course-control__times"><p>공단 기준 {time(o.sourceAsOf)}</p><p>마지막 확인 {time(o.checkedAt)}</p></div>
    {uncertain && <p className="course-control__warning" role="status">최신 상태를 확인하지 못했어요. 방문 전 공단 원문을 확인해 주세요.</p>}
    {restricted ? <>
      <p className="course-control__reason">{o.reason || '관할 탐방로 통제 안내'}</p>
      <p className="course-spots__notice">사무소 관할 안내입니다. 아래 구간이 선택한 코스에 포함되는지 확인해 주세요.</p>
      <dl>{o.restrictedSection && <><dt>통제구간</dt><dd>{o.restrictedSection}</dd></>}{o.restrictionPeriodText && <><dt>통제기간</dt><dd>{o.restrictionPeriodText}</dd></>}</dl>
      {previews.map((a, i) => <ControlImage key={`${a.sourceUrl}/${a.imageUrl}/${i}`} asset={a} onFailure={renewImages} />)}
      {o.contentText ? <details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}><summary>상세 안내</summary><p className="course-control__text">{o.contentText}</p></details> : <p>상세 안내를 확인하지 못했어요. 공단 원문을 확인해 주세요.</p>}
      {o.contact && <p className="course-control__contact">문의: {o.contact}</p>}
      {o.collectionState === 'ASSET_ERROR' && <p role="status">일부 첨부 이미지를 가져오지 못했어요. 원본 첨부를 확인해 주세요.</p>}
    </> : o.status === 'NORMAL' && <p>{uncertain ? '마지막 수집 당시 공단 목록상 정상 상태였어요.' : '공단 목록상 해당 사무소 관할 탐방로가 정상 상태입니다.'}</p>}
    <footer><a href={o.sourceUrl} target="_blank" rel="noopener noreferrer">공단 원문 보기 ↗</a></footer>
  </article>;
}
