# Backend

Java 21, Spring Boot, PostgreSQL/PostGIS 기반 백엔드입니다.

## 실행

1. `src/main/resources/application-secret.properties` 파일을 로컬에서 만들고 DB/R2 값을 설정합니다.
2. PostgreSQL + PostGIS를 실행합니다.
3. Windows에서는 다음 명령으로 서버를 실행합니다.

```powershell
.\gradlew.bat bootRun
```

테스트와 빌드는 다음 명령으로 확인합니다.

```powershell
.\gradlew.bat test
.\gradlew.bat bootJar
```

## 개발용 시드 데이터

등산 일정 API를 화면과 함께 확인하려면 빈 개발 DB에 `docs/dev-seed-hike-courses.sql`을 실행합니다. 프론트 임시 코스 데이터와 같은 산 5개·코스 11개와 임시 사용자(1번)를 넣습니다. Flyway 마이그레이션이 아니므로 운영 DB에는 실행하지 않습니다.

```powershell
docker exec -i <PostGIS 컨테이너> psql -U postgres -d trail_map < docs/dev-seed-hike-courses.sql
```

## 코드 구조

- 공통 설정·응답·예외·감사 엔티티는 `global`에 둡니다.
- 실제 도메인 코드는 `domain/<도메인명>` 아래에 생성합니다.
- 각 도메인은 `entity`, `repository`, `service`, `controller`, `dto/request`, `dto/response`, `error`, `exception` 구조를 따릅니다.

## 데이터 접근

- 일반 CRUD는 Spring Data JPA를 사용합니다.
- 공간 데이터·대량·특수 SQL은 JdbcTemplate 또는 JDBC와 PostGIS SQL을 사용합니다.
- SQL은 Repository 계층에만 둡니다.
- Controller는 Repository를 직접 호출하지 않습니다.
- JPA와 JdbcTemplate을 함께 사용할 때 트랜잭션 경계는 Service 계층에 둡니다.
- `application-secret.properties`와 실제 비밀값은 커밋하지 않습니다.

## DB 변경

DB 스키마, PostGIS, Flyway migration 작업 시 `docs/migration.md`를 확인합니다.

## Terrain-RGB 타일 API

북한산 Terrain-RGB 산출물은 프로젝트 루트의
`data/processed/dem/bukhansan/terrain`에 둡니다. 다른 경로를 사용하거나
프론트엔드에서 접근할 공개 주소가 달라지는 경우 다음 환경 변수를 설정합니다.

```text
TERRAIN_ROOT_PATH=/absolute/path/to/terrain
TERRAIN_TILES_URL=http://localhost:8080/api/v1/terrain/{z}/{x}/{y}.png
TERRAIN_CACHE_MAX_AGE=PT1H
```

- `GET /api/v1/terrain/tilejson`: TileJSON 메타데이터
- `GET /api/v1/terrain/source`: MapLibre `raster-dem` source 설정
- `GET /api/v1/terrain/{z}/{x}/{y}.png`: Terrain-RGB PNG 타일

로컬 기본값은 백엔드 `http://localhost:8080`과 프로젝트 루트의 Terrain
산출물 경로를 사용합니다. 타일 파일을 교체한 경우 메타데이터 캐시 갱신을 위해
백엔드를 다시 실행합니다.

## 등산 기록 API

임시 사용자 식별 헤더 `X-User-Id`가 필요합니다. 상태는 `IN_PROGRESS`(등산 중) → `DESCENDING`(하산 중) → `COMPLETED`(완료) 순서로만 바뀝니다.

- `POST /api/v1/hike-records`: `{"scheduleId"}`로 오늘 일정의 등산을 시작합니다. 시작 시각과 그 시점의 코스 번호·버전·경로를 저장합니다. 오늘이 아닌 일정(`HIKE_409_2`), 이미 기록이 있는 일정(`HIKE_409_3`), 진행 중인 등산이 있을 때(`HIKE_409_4`)는 시작할 수 없습니다.
- `GET /api/v1/hike-records/active`: 진행 중인 기록을 조회합니다. 없으면 `data`가 `null`입니다.
- `GET /api/v1/hike-records/{hikeRecordId}`: 상태, 시작·종료 시각, 이동 거리, 소요 시간, 이동 경로 좌표(`[경도, 위도]` 목록)를 조회합니다.
- `POST /api/v1/hike-records/{hikeRecordId}/positions`: 기기가 모은 GPS 위치 묶음(`longitude`, `latitude`, `recordedAt`, `accuracyMeters`, 최대 500개)을 이동 경로(`traveled_path`, LineString)에 이어 붙이고 이동 거리를 갱신합니다. 측정 시각 순으로 정렬하고, 정확도가 50m보다 나쁜 위치와 직전 위치에서 5m 미만 움직인 위치는 뺍니다.
- `POST /api/v1/hike-records/{hikeRecordId}/descend`: 하산을 시작합니다.
- `POST /api/v1/hike-records/{hikeRecordId}/finish`: 등산을 종료하고 종료 시각, 소요 시간(종료-시작 경과 초), 최종 이동 거리를 저장합니다. 이미 종료된 기록이면 그 기록을 그대로 반환합니다. 종료 후 위치 전송·하산 요청은 `HIKE_409_5`입니다.

이동 거리는 경로 길이를 구면 거리(`geography`)로 계산하며, 위치를 한 번도 받지 않았으면 `null`입니다. 아래 커뮤니티의 `POST /api/v1/hike-schedules/{scheduleId}/complete`는 그 일정으로 시작한 진행 중 기록이 있으면 그 기록을 종료합니다.

## 커뮤니티 API

모든 커뮤니티 조회 요청은 임시 사용자 식별 헤더 `X-User-Id`가 필요합니다.

등산 종료 시 `POST /api/v1/hike-schedules/{scheduleId}/complete`를 호출하면 해당 일정의 코스 경로를 보존한 `COMPLETED` 산행 기록을 한 번만 생성합니다. 이 기록이 아래 후기 작성 자격에 사용됩니다.

- `GET /api/v1/community/mountains`: 커뮤니티에서 선택할 산과 지도 표시 좌표를 조회합니다.
- `GET /api/v1/community/mountains/{mountainId}/courses`: 산에 속한 코스, 거리, 경로 좌표와 후기 수를 조회합니다.
- `GET /api/v1/community/mountains/{mountainId}/spots`: 지도 영역의 공식 시설과 사용자 스팟을 함께 조회합니다. `west`, `south`, `east`, `north`가 필수이며 `type`으로 종류를 선택할 수 있습니다.
- `GET /api/v1/community/mountains/{mountainId}/spots/{targetType}/{targetId}`: 스팟 상세와 투표·후기·사진 집계를 조회합니다.
- `GET /api/v1/community/mountains/{mountainId}/reviews`: 산 후기를 조회합니다.
- `GET /api/v1/community/courses/{courseId}/reviews`: 코스 후기를 조회합니다.
- `GET /api/v1/community/mountains/{mountainId}/spots/{targetType}/{targetId}/reviews`: 스팟 후기를 조회합니다.
- `GET /api/v1/community/mountains/{mountainId}/review-eligibility`: 산 후기 작성이 가능한 최근 산행을 조회합니다.
- `GET /api/v1/community/courses/{courseId}/review-eligibility`: 코스 후기 작성이 가능한 최근 산행을 조회합니다.
- `GET /api/v1/community/mountains/{mountainId}/spots/{targetType}/{targetId}/review-eligibility`: 스팟 후기 작성이 가능한 최근 산행을 조회합니다.
- `POST /api/v1/community/mountains/{mountainId}/reviews`: 산 후기와 1~5점 평점을 등록합니다.
- `POST /api/v1/community/courses/{courseId}/reviews`: 코스 후기를 등록합니다.
- `POST /api/v1/community/mountains/{mountainId}/spots/{targetType}/{targetId}/reviews`: 공식 시설 또는 사용자 스팟 후기를 등록합니다.
- `GET /api/v1/community/mountains/{mountainId}/spots/duplicates`: 좌표 기준 50m 이내 같은 유형의 공식 시설·사용자 스팟을 조회합니다.
- `POST /api/v1/community/mountains/{mountainId}/spots`: 사용자 스팟을 등록합니다.
- `PUT /api/v1/community/mountains/{mountainId}/spots/{targetType}/{targetId}/vote`: `YES` 또는 `NO` 평가를 등록하거나 변경합니다.
- `DELETE /api/v1/community/mountains/{mountainId}/spots/{targetType}/{targetId}/vote`: 현재 사용자의 평가를 취소합니다.
- `POST /api/v1/community/photos/upload-url`: 본인이 작성한 후기 또는 사용자 스팟에 사진을 올릴 R2 presigned PUT URL을 발급합니다.
- `POST /api/v1/community/photos`: R2 업로드 완료 후 사진 메타데이터를 확정합니다.
- `GET /api/v1/community/mountains/{mountainId}/photos`: 산 후기 사진을 조회합니다.
- `GET /api/v1/community/courses/{courseId}/photos`: 코스 후기 사진을 조회합니다.
- `GET /api/v1/community/mountains/{mountainId}/spots/{targetType}/{targetId}/photos`: 스팟 직접 사진과 후기 사진을 조회합니다.
- `GET /api/v1/community/photos/{photoId}`: 사진 상세를 조회합니다.

지도·스팟 API의 `targetType`은 `FACILITY` 또는 `USER_SPOT`, 스팟 `type`은 `SHELTER`, `WATER`, `RESTROOM`, `PHOTO`, `OTHER`를 사용합니다. 사진 업로드 API의 `targetType`은 `MOUNTAIN_REVIEW`, `COURSE_REVIEW`, `SPOT_REVIEW`, `USER_SPOT`을 사용합니다. 후기 목록은 `limit`(기본 20, 최대 100)과 `offset`(기본 0)을 지원합니다. `representativePhotoUrl`과 `photoUrls`는 비공개 R2 객체의 만료 가능한 조회 URL을 반환합니다.

후기와 사용자 스팟 등록에는 본인의 `COMPLETED` 산행 중 종료 후 24시간 이내인 `hikeRecordId`가 필요합니다. 같은 코스를 여러 번 완주했다면 가장 최근 기록만 작성 자격으로 인정합니다. 사용자 스팟 등록 시 50m 이내에 같은 유형의 후보가 있으면 `409`를 반환하며, 사용자가 별도 장소임을 확인한 뒤 `confirmDistinct=true`로 다시 요청할 수 있습니다. 사진 업로드는 R2 연동 API에서 별도로 처리합니다.

스팟 평가는 사용자와 대상별로 한 건만 유지됩니다. 사용자 스팟은 `NO` 평가가 3건 이상이면 `HIDDEN`으로 변경되어 지도와 중복 후보에서 제외되고, 평가 변경·취소로 3건 미만이 되면 `RECONFIRMATION_REQUIRED`로 다시 노출됩니다. 공식 시설은 평가 수만 집계하며 자동으로 숨기지 않습니다.

## 사용자 프로필 API

요청 헤더 `X-User-Id`에 지정한 사용자 ID를 기준으로 닉네임을 조회하고 변경합니다.

- `GET /api/v1/users/me`: 현재 사용자의 닉네임을 조회합니다.
- `PATCH /api/v1/users/me`: `nickname`을 변경합니다. 최대 12자이며 빈 문자열은 DB에 `NULL`로 저장하고 `익명{userId}`로 응답합니다.

닉네임은 중복을 허용하며, 산·코스·스팟 후기와 사진 작성자 조회에 현재 `app_user.nickname`이 반영됩니다.

## 공식 시설 데이터

산 소속 판정이 완료된 JSON v2를 적재한다. 기존 시설 소속 갱신과 코스 조회 조건은 [산 경계 문서](../docs/facility-mountain-boundary.md)를 참고한다.

화장실 시범 전처리·JDBC 적재·조회 API·검증 방법은 [시설 데이터 문서](../docs/facilities.md)를 참고합니다.

### 커뮤니티 사진 저장

R2 버킷은 비공개로 유지하고 클라이언트가 presigned PUT URL로 직접 업로드합니다. 파일은 JPEG, PNG, WebP만 허용하며 파일당 최대 5MB, 대상당 최대 3장입니다. 업로드 완료 후 확정 API가 R2 객체의 크기와 MIME을 확인한 뒤 `photo` 테이블에 메타데이터를 저장합니다. 공식 시설 사진은 시설에 직접 올리지 않고 본인이 작성한 스팟 후기에 연결합니다.

```text
community/mountain/{mountainId}/{reviewId}/{uuid}.{ext}
community/course/{courseId}/{reviewId}/{uuid}.{ext}
community/spot/user-spot/{spotId}/{uuid}.{ext}
community/spot/user-spot/{spotId}/{reviewId}/{uuid}.{ext}
community/spot/facility/{facilityId}/{reviewId}/{uuid}.{ext}
```

로컬 비밀 설정에는 `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`를 두고 필요하면 `R2_BUCKET_NAME`을 설정합니다. 기본 버킷명은 `trail-map`입니다.

## 공식 시설 공통 파이프라인 (#75)

화장실·쉼터·음수대의 한 번의 전처리, 출처별 JSON v2 적재, 산 소속 판정 및 실행·검증 방법은 [공통 시설 파이프라인](../docs/facility-pipeline.md)을 따른다. 개별 어댑터의 v1은 후보 검토용이며 직접 DB에 적재하지 않는다.
