# 통제정보 조회와 적재 계약 (#130)

조회 API는 코스의 담당 사무소에 대해 DB에 저장된 통제 안내를 읽는다. [공단 자료 수집기](park-control-import.md)가 사무소별 상태와 첨부를 적재한다. 배포 서버에는 주 1회 자동 실행 타이머를 설치할 수 있고, 같은 수집기를 수동으로도 실행할 수 있다.

## 스키마

새 DB는 V11 migration으로 테이블과 두 사무소 식별 행만 생성한다. 최초 상태는 UNKNOWN/MISSING이다. 기존 DB에 동명의 테이블이 있다면 적용 전에 스키마와 Flyway 이력을 대조한다. #130 검증에서 격리한 PostgreSQL/PostGIS 개발 DB에 V11을 적용해 두 차례 수집했고, 공용 DB에서도 V11 이력과 두 사무소 적재를 읽기 전용으로 확인했다.

`park_access_control`은 사무소별 현재 상태를 저장한다.

| 컬럼 | 용도 |
| --- | --- |
| control_id | 내부 PK |
| version | JPA 낙관적 잠금 버전; 외부 갱신 시 증가 |
| source_record_id | 공단 rstId: 0019, 0020; UNIQUE |
| mountain_key | 0019=bukhansan, 0020=dobongsan; UNIQUE |
| office_name / source_url | 표시할 사무소명과 공단 상세 HTTPS 주소 |
| status | UNKNOWN, NORMAL, PARTIAL, CLOSED |
| reason / content_text | 사유와 줄바꿈을 보존한 본문 텍스트 |
| restricted_section / restriction_period_text / contact | 구간, 기간 원문, 문의처; 추출 불가 시 NULL |
| source_as_of | 공단 기준시간 |
| checked_at | 목록에서 해당 상태를 성공적으로 확인한 시각 |
| detail_fetched_at | 해당 본문을 성공적으로 가져온 시각 |
| last_attempt_at | 마지막 수집 시도 시각 |
| collection_state | MISSING, READY, ERROR, ASSET_ERROR |

시간은 TIMESTAMPTZ이며 원문의 한국시간을 UTC instant로 변환한다. 기준시간이 오래됐다는 이유로 통제 해제로 간주하지 않는다. 조회 시 마지막 성공 확인 시각(checked_at)으로부터 7일(`park-control.stale-after=P7D`)이 지났는지 검사한다.

`park_access_control_asset`은 control_id FK + asset_order(0부터 시작) PK로 이미지·첨부를 여러 건 저장한다. kind는 INLINE/ATTACHMENT, name은 표시명, source_url은 원본 HTTPS 링크, object_key는 이미 저장된 R2 객체 키, media_type은 실제 MIME 형식이다. 저장 실패 시 object_key/media_type은 NULL로 두고 ASSET_ERROR로 표시한다. 만료되는 서명 URL은 DB에 저장하지 않는다.

## 수집기 인계 규칙

- 상태, 본문, 자산 목록을 사무소 단위 트랜잭션으로 교체한다.
- 정상 전환 시 과거 상세·자산 참조를 비운다. API도 NORMAL일 때 상세와 자산을 제외한다.
- 목록 실패는 checked_at을 갱신하지 않고 ERROR를 기록한다. 기존 상태가 NORMAL이어도 화면은 최신 확인 실패로 표시한다.
- 새 목록과 상세가 불일치하거나 상세 실패 시 과거 본문을 새 기준시간의 본문으로 재사용하지 않는다.
- 성공적인 본문과 이미지 일부 실패는 ASSET_ERROR로 기록한다. 본문은 제공하고 원본 첨부 링크를 함께 반환한다.
- 조회 API는 이미지 다운로드나 업로드를 수행하지 않는다. 수집기는 기본적으로 이미지를 로컬에 저장하며, `park-control.import.upload=true`이면 기존 R2 설정으로 업로드하고 객체 키를 DB에 기록한다. 조회 API는 해당 객체 키를 이용해 임시 읽기 URL을 발급한다.
- 일반 문서 첨부는 원본 파일명과 링크를 유지한다. 이미지 파일명과 실제 형식이 다르면 바이트에서 확인한 형식을 사용한다.

## 조회 API

`GET /api/v1/courses/{courseId}/access-control` — SuccessResponse.data:

- courseId, mountainKey, coverage=OFFICE_REGION
- availability=AVAILABLE/MISSING/UNSUPPORTED
- office: sourceRecordId, name, status, collectionState, stale, sourceAsOf, checkedAt, detailFetchedAt, reason, restrictedSection, restrictionPeriodText, contentText, contact, sourceUrl, assets[]
- assets: kind, name, sourceUrl, imageUrl(서명 URL 또는 NULL)

코스 존재 여부를 먼저 확인하고 course_route_metadata.mountain_key로 사무소를 결정한다. 존재하지 않는 코스는 404, 잘못된 ID는 400이다. 매핑이 없는 코스는 UNSUPPORTED, 적재 전이면 MISSING이다. 읽기 전용 Service에서 Repository를 호출한다. 응답은 Cache-Control: no-store이며 조회 요청이 수집기를 호출하지 않는다.

개별 코스가 통제구간과 겹치는지 판정한 결과는 아니다. 두 산의 현재 후보 코스 그룹과 사무소를 연결한 안내이며, 새로운 교차 관할 코스가 추가되면 매핑을 검토해야 한다.

## 검증

`./gradlew.bat test --tests '*parkcontrol*' --tests '*FlywayMigrationDefinitionTest' bootJar`

새로운 DB에서는 전체 Flyway PostGIS 테스트도 실행한다. 테스트용 DTO/행을 사용하며 실제 공단 상태를 시험 데이터로 DB에 적재하지 않는다.
