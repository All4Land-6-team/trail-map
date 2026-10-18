import { Button } from '../../../components/common/Button'
import { RatingInput } from '../../../components/review/RatingInput'
import { MultilineField } from '../../../components/review/MultilineField'
import { Icon } from '../../../components/common/Icon'
import { communityCourse } from '../../../api/communityMock'
import type { CommunitySpot, ReviewDraft, SegmentStatus } from '../../../types/community'
import { CommunityMap, type CommunityMapMarker } from './CommunityMap'
import { PhotoField } from './PhotoField'

const statuses: { value: SegmentStatus; label: string }[] = [
  { value: 'good', label: '양호' }, { value: 'caution', label: '주의 필요' }, { value: 'danger', label: '위험' },
]

type Props = {
  draft: ReviewDraft
  mountainName: string
  spot?: CommunitySpot
  errors: Record<string, string>
  canSubmit: boolean
  eligibilityMessage: string
  onChange: (patch: Partial<ReviewDraft>) => void
  onError: (message: string) => void
  onChooseSpot: () => void
  onChooseSegment: () => void
  onNewSpot: () => void
  onSubmit: () => void
}

export function ReviewForm({ draft, mountainName, spot, errors, canSubmit, eligibilityMessage, onChange, onError, onChooseSpot,
  onChooseSegment, onNewSpot, onSubmit }: Props) {
  const segmentMarkers: CommunityMapMarker[] = draft.segmentCoordinates?.length ? [
    { id: 'start', name: '출발', shortLabel: '출', kind: 'point', coordinate: draft.segmentCoordinates[0] },
    { id: 'end', name: '도착', shortLabel: '도', kind: 'point', coordinate: draft.segmentCoordinates.at(-1)! },
  ] : []
  return <div className={`community-form-layout community-form-layout--review community-form-layout--review-${draft.kind}`}>
    <div className="community-form-layout__scroll">
      <h2>{draft.kind === 'mountain' ? `${mountainName} 후기` : draft.kind === 'spot' ? spot?.name ?? '스팟 후기' : '구간 후기'}</h2>
      {draft.kind === 'mountain' && <div className="community-form-section">
        <span className="community-field-label">평점</span>
        <RatingInput value={draft.rating} onChange={rating => onChange({ rating })} />
        {errors.rating && <p className="community-field-error" role="alert">{errors.rating}</p>}
      </div>}
      {draft.kind === 'spot' && <div className="community-form-section">
        <p className="community-form-subtitle">스팟 후기</p>
        <button type="button" className="community-target-card" onClick={onChooseSpot}>
          <Icon name="Pin" size={22} />
          <span className="community-target-card__copy"><strong>{spot?.name ?? '스팟을 선택해 주세요'}</strong><small>지도에서 선택한 스팟</small></span>
          <span>위치 변경</span>
        </button>
        {errors.target && <p className="community-field-error" role="alert">{errors.target}</p>}
        <button type="button" className="community-inline-link" onClick={onNewSpot}>찾는 스팟이 없나요? 새 스팟 등록</button>
      </div>}
      {draft.kind === 'segment' && <div className="community-form-section">
        <p className="community-form-subtitle">선택한 구간</p>
        <div className="community-segment-preview"><CommunityMap markers={segmentMarkers} center={communityCourse.routeCoordinates[3]} zoom={14.4} ariaLabel="선택한 구간" />
          <div><span>지도에서 선택한 구간</span><button type="button" onClick={onChooseSegment}>구간 변경</button></div>
        </div>
        {errors.target && <p className="community-field-error" role="alert">{errors.target}</p>}
        <span className="community-field-label">구간 상태</span>
        <div role="group" aria-label="구간 상태" className="community-status-options">
          {statuses.map(status => <button key={status.value} type="button" data-status={status.value}
            aria-pressed={draft.status === status.value} onClick={() => onChange({ status: status.value })}>{status.label}</button>)}
        </div>
        {errors.status && <p className="community-field-error" role="alert">{errors.status}</p>}
      </div>}
      <div className="community-form-section">
        <label className="community-field-label" htmlFor="community-review-content">후기</label>
        <MultilineField id="community-review-content" value={draft.content} maxLength={1000}
          aria-describedby={errors.content ? 'community-review-error' : undefined}
          onChange={event => onChange({ content: event.target.value })}
          placeholder={draft.kind === 'mountain' ? '산에서의 경험을 적어주세요' : draft.kind === 'spot' ? '이 스팟에서 본 것을 적어주세요' : '길 상태나 경험을 적어주세요'} />
        {errors.content && <p id="community-review-error" className="community-field-error" role="alert">{errors.content}</p>}
      </div>
      <PhotoField photos={draft.photos} onChange={photos => onChange({ photos })} onError={onError} />
      {draft.kind === 'mountain' && <p className="community-visited-course">다녀온 코스<br /><strong>{communityCourse.name}</strong></p>}
    </div>
    <div className="community-form-layout__action"><Button fullWidth disabled={!canSubmit} label={draft.kind === 'segment' ? '구간 후기 게시' : '후기 게시'} onClick={onSubmit} />{!canSubmit && <p className="community-eligibility" role="status">{eligibilityMessage}</p>}</div>
  </div>
}
