import { useEffect, useMemo, useRef, useState } from 'react';
import { facilityReviewUrl, filterFacilities, loadFacilityReview } from '../../api/facilities';
import { Icon } from '../../components/common/Icon';
import type { CourseFacilityType, Facility } from '../../types/facility';
import { facilitySpotKind } from '../../utils/courseFacilities';
import { FacilityPreviewMap } from './FacilityPreviewMap';
import './facility-preview.css';

type State = { status: 'loading' } | { status: 'error'; message: string }
  | { status: 'success'; facilities: Facility[] };
const EMPTY: Facility[] = [];

function readSourceId() {
  const value = new URLSearchParams(window.location.search).get('sourceId') ?? '';
  const number = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function FacilityPreviewPage() {
  const [sourceId] = useState(readSourceId);
  const [type] = useState<CourseFacilityType>(() => {
    const requested = new URLSearchParams(window.location.search).get('type');
    return requested === 'DRINKING_WATER' || requested === 'SHELTER' ? requested : 'RESTROOM';
  });
  const label = type === 'DRINKING_WATER' ? '음수대' : type === 'SHELTER' ? '쉼터' : '화장실';
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fitRequest, setFitRequest] = useState(0);
  const [copyStatus, setCopyStatus] = useState('');
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  const facilities = state.status === 'success' ? state.facilities : EMPTY;
  const visible = useMemo(() => filterFacilities(facilities, query), [facilities, query]);
  const selected = visible.find(facility => facility.facilityId === selectedId) ?? null;

  useEffect(() => {
    if (sourceId === null) return;
    const controller = new AbortController();
    loadFacilityReview(sourceId, { signal: controller.signal, type }).then(collection => {
      if (!controller.signal.aborted) setState({ status: 'success', facilities: collection.features.map(feature => feature.properties) });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ status: 'error', message: error instanceof Error ? error.message : '조회에 실패했습니다.' });
    });
    return () => controller.abort();
  }, [sourceId, attempt, type]);

  useEffect(() => {
    const button = selectedButton.current;
    const list = button?.closest('.facility-preview__list');
    if (!button || !list) return;
    const item = button.getBoundingClientRect();
    const parent = list.getBoundingClientRect();
    if (item.top < parent.top || item.bottom > parent.bottom) {
      list.scrollTo({ top: list.scrollTop + item.top - parent.top - parent.height / 2 + item.height / 2 });
    }
  }, [selected]);

  function select(id: number) { setSelectedId(id); setCopyStatus(''); }
  function showAll() { setQuery(''); setSelectedId(null); setCopyStatus(''); setFitRequest(value => value + 1); }
  function refresh() { setState({ status: 'loading' }); setSelectedId(null); setCopyStatus(''); setAttempt(value => value + 1); }
  async function copyId() {
    if (!selected?.sourceRecordId) return;
    try { await navigator.clipboard.writeText(selected.sourceRecordId); setCopyStatus('원본 식별자를 복사했습니다.'); }
    catch { setCopyStatus('복사하지 못했습니다. 아래 원본 식별자를 직접 선택해 주세요.'); }
  }

  return <main className="facility-preview">
    <header className="facility-preview__header">
      <div><span className="facility-preview__eyebrow">함께 채우는 산길 지도 · 개발용 조회</span>
        <h1>{label} 데이터 확인</h1>
        <p>지도의 점이나 목록을 선택해 위치와 원본 정보를 확인하세요.</p>
      </div>
      <a className="facility-preview__home" href="/">서비스 홈으로</a>
    </header>
    <div className="facility-preview__notice">
      <strong>북한산·도봉산 시설 데이터입니다.</strong>
      <span>{type === 'DRINKING_WATER' ? '현재 이용 가능 여부와 음용 적합 여부는 확인되지 않았습니다.'
        : '원본의 상태값은 현재 운영 여부를 의미하지 않습니다.'}</span>
    </div>
    <div className="facility-preview__toolbar">
      <label>이름·원본 식별자 검색<input type="search" value={query} placeholder="시설명 또는 원본 식별자"
        onChange={event => { setQuery(event.target.value); setSelectedId(null); setCopyStatus(''); }} /></label>
      <div className="facility-preview__actions">
        <button type="button" onClick={showAll} disabled={state.status !== 'success'}>전체 보기</button>
        <button type="button" onClick={refresh} disabled={sourceId === null || state.status === 'loading'}>새로고침</button>
      </div>
      <p className="facility-preview__count" role="status">{state.status === 'success'
        ? <><strong>{visible.length}</strong> / {facilities.length}건</> : '시설 데이터 조회'}<small>출처 ID {sourceId ?? '미지정'}</small></p>
    </div>
    {sourceId === null ? <div className="facility-preview__state" role="alert">
      <h2>출처 ID를 확인해 주세요.</h2><p>주소의 sourceId에 백엔드 적재 로그의 출처 번호를 지정하세요.</p>
    </div> : state.status === 'loading' ? <div className="facility-preview__state" aria-busy="true" role="status">DB에서 시설을 불러오고 있습니다.</div>
      : state.status === 'error' ? <div className="facility-preview__state" role="alert">
        <h2>시설을 불러오지 못했습니다.</h2><p>{state.message}</p><button type="button" onClick={refresh}>다시 시도</button>
      </div> : <div className="facility-preview__workspace">
        <FacilityPreviewMap type={type} label={label} facilities={visible} selected={selected} fitRequest={fitRequest} onSelect={select} />
        <aside className="facility-preview__sidebar" aria-label={`${label} 목록과 상세정보`}>
          <section className="facility-preview__detail" aria-labelledby="facility-detail-title">
            <span className="facility-preview__eyebrow">선택한 {label}</span>
            <h2 id="facility-detail-title">{selected?.name ?? (selected ? '이름 없음' : '시설을 선택하세요')}</h2>
            {selected ? <>
              <div className="facility-preview__identity"><strong>원본 식별자 {selected.sourceRecordId ?? '없음'}</strong>
                <button type="button" disabled={!selected.sourceRecordId} onClick={() => void copyId()}>ID 복사</button>
              </div>
              <p className="facility-preview__copy" role="status">{copyStatus}</p>
              <dl>
                <dt>시설 ID</dt><dd>{selected.facilityId}</dd>
                <dt>경도 / 위도</dt><dd>{selected.longitude.toFixed(7)}<br />{selected.latitude.toFixed(7)}</dd>
                <dt>유형</dt><dd>{label} · {selected.type}</dd>
                <dt>산 ID</dt><dd>{selected.mountainId ?? '미지정'}</dd>
                <dt>원본 상태</dt><dd>{selected.sourceReportedStatus ?? '정보 없음'}</dd>
                <dt>자료 기준일</dt><dd>{selected.sourceDate ?? '정보 없음'}</dd>
                <dt>출처</dt><dd>{selected.source.name}</dd>
                <dt>제공 기관</dt><dd>{selected.source.provider ?? '정보 없음'}</dd>
                <dt>원본 형식</dt><dd>{selected.source.format} · {selected.source.crs ?? 'CRS 미상'}</dd>
                <dt>원본 버전</dt><dd>{selected.source.version ?? '정보 없음'}</dd>
                <dt>적재 시각</dt><dd>{selected.importedAt}</dd>
              </dl>
            </> : <p>이름과 원본 ID, 좌표, 출처를 여기에서 확인할 수 있습니다. 같은 좌표의 시설도 목록에서 각각 선택하세요.</p>}
          </section>
          <div className="facility-preview__list-heading"><h2>{label} 목록</h2><span>{visible.length}건</span></div>
          <div className="facility-preview__list">
            {visible.length === 0 ? <p className="facility-preview__empty">{facilities.length === 0
              ? '이 출처에는 해당 유형의 시설 데이터가 없습니다.' : '검색 결과가 없습니다. 이름 또는 원본 식별자를 다시 확인하세요.'}</p>
              : <ul>{visible.map(facility => <li key={facility.facilityId}>
                <button type="button" ref={selected?.facilityId === facility.facilityId ? selectedButton : undefined}
                  aria-pressed={selected?.facilityId === facility.facilityId} onClick={() => select(facility.facilityId)}>
                  <span className="facility-preview__list-icon" data-kind={facilitySpotKind(type)} aria-hidden="true">
                    <Icon name={type === 'DRINKING_WATER' ? 'Water' : type === 'SHELTER' ? 'Shelter' : 'Restroom'} size={18} /></span>
                  <span><strong>{facility.name ?? '이름 없음'}</strong><small>원본 식별자 {facility.sourceRecordId ?? '없음'} · 시설 ID {facility.facilityId}</small></span>
                </button>
              </li>)}</ul>}
          </div>
        </aside>
      </div>}
    <footer className="facility-preview__footer"><span>읽기 전용 · 코스 거리 및 산 경계 필터 미적용</span>
      {sourceId !== null && <a href={facilityReviewUrl(sourceId, undefined, type)} target="_blank" rel="noreferrer">GeoJSON 응답 열기 ↗</a>}
    </footer>
  </main>;
}
