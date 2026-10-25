import { Button } from '../../../components/common/Button'
import { RatingInput } from '../../../components/review/RatingInput'
import { MultilineField } from '../../../components/review/MultilineField'
import { Icon } from '../../../components/common/Icon'
import type { CompletedHike } from '../../../store/hikeSessionStore'
import type { CommunitySpot, ReviewDraft } from '../../../types/community'
import { PhotoField } from './PhotoField'

type Props = {
  draft: ReviewDraft
  mountainName: string
  spot?: CommunitySpot
  errors: Record<string, string>
  canSubmit: boolean
  eligibleCourses: readonly CompletedHike[]
  onChange: (patch: Partial<ReviewDraft>) => void
  onError: (message: string) => void
  onChooseSpot: () => void
  onNewSpot: () => void
  onSubmit: () => void
}

export function ReviewForm({ draft, mountainName, spot, errors, canSubmit, onChange, onError, onChooseSpot,
  eligibleCourses, onNewSpot, onSubmit }: Props) {
  const completedAt = (finishedAt: string) => new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(finishedAt))
  return <div className={`community-form-layout community-form-layout--review community-form-layout--review-${draft.kind}`}>
    <div className="community-form-layout__scroll">
      <h2>{draft.kind === 'mountain' ? `${mountainName} 후기` : draft.kind === 'spot' ? spot?.name ?? '스팟 후기' : '코스 후기'}</h2>
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
      {draft.kind === 'course' && <fieldset className="community-form-section community-course-options">
        <legend className="community-field-label">후기를 남길 코스</legend>
        <p className="community-form-subtitle">최근 24시간 안에 완료한 코스만 표시됩니다.</p>
        {eligibleCourses.map(course => <label key={course.id} className="community-course-option">
          <input type="radio" name="completed-course" value={course.id} checked={draft.completedHikeId === course.id}
            onChange={() => onChange({ targetId: course.courseId, completedHikeId: course.id })} />
          <span className="community-course-option__indicator" aria-hidden="true" />
          <span className="community-course-option__copy"><strong>{course.courseName}</strong>
            <small>{completedAt(course.finishedAt)} 완료 · {course.distanceKm} km</small></span>
        </label>)}
        {errors.target && <p className="community-field-error" role="alert">{errors.target}</p>}
      </fieldset>}
      <div className="community-form-section">
        <label className="community-field-label" htmlFor="community-review-content">후기</label>
        <MultilineField id="community-review-content" value={draft.content} maxLength={1000}
          aria-describedby={errors.content ? 'community-review-error' : undefined}
          onChange={event => onChange({ content: event.target.value })}
          placeholder={draft.kind === 'mountain' ? '산에서의 경험을 적어주세요' : draft.kind === 'spot' ? '이 스팟에서 본 것을 적어주세요' : '이 코스에서의 경험을 적어주세요'} />
        {errors.content && <p id="community-review-error" className="community-field-error" role="alert">{errors.content}</p>}
      </div>
      <PhotoField photos={draft.photos} onChange={photos => onChange({ photos })} onError={onError} />
    </div>
    <div className="community-form-layout__action"><Button fullWidth disabled={!canSubmit} label={draft.kind === 'course' ? '코스 후기 게시' : '후기 게시'} onClick={onSubmit} /></div>
  </div>
}
