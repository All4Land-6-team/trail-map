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

## 커뮤니티 API

모든 커뮤니티 조회 요청은 임시 사용자 식별 헤더 `X-User-Id`가 필요합니다.

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
- `GET /api/v1/community/mountains/{mountainId}/spots/duplicates`: 좌표 기준 30m 이내 같은 유형의 공식 시설·사용자 스팟을 조회합니다.
- `POST /api/v1/community/mountains/{mountainId}/spots`: 사용자 스팟을 등록합니다.
- `PUT /api/v1/community/mountains/{mountainId}/spots/{targetType}/{targetId}/vote`: `YES` 또는 `NO` 평가를 등록하거나 변경합니다.
- `DELETE /api/v1/community/mountains/{mountainId}/spots/{targetType}/{targetId}/vote`: 현재 사용자의 평가를 취소합니다.

`targetType`은 `FACILITY` 또는 `USER_SPOT`, 스팟 `type`은 `SHELTER`, `WATER`, `RESTROOM`, `PHOTO`, `OTHER`를 사용합니다. 후기 목록은 `limit`(기본 20, 최대 100)과 `offset`(기본 0)을 지원합니다. `representativePhotoKey`와 `photoKeys`는 R2 공개 URL 연결 전까지 저장 객체 키를 반환합니다.

후기와 사용자 스팟 등록에는 본인의 `COMPLETED` 산행 중 종료 후 24시간 이내인 `hikeRecordId`가 필요합니다. 같은 코스를 여러 번 완주했다면 가장 최근 기록만 작성 자격으로 인정합니다. 사용자 스팟 등록 시 30m 이내에 같은 유형의 후보가 있으면 `409`를 반환하며, 사용자가 별도 장소임을 확인한 뒤 `confirmDistinct=true`로 다시 요청할 수 있습니다. 사진 업로드는 R2 연동 API에서 별도로 처리합니다.

스팟 평가는 사용자와 대상별로 한 건만 유지됩니다. 사용자 스팟은 `NO` 평가가 3건 이상이면 `HIDDEN`으로 변경되어 지도와 중복 후보에서 제외되고, 평가 변경·취소로 3건 미만이 되면 `RECONFIRMATION_REQUIRED`로 다시 노출됩니다. 공식 시설은 평가 수만 집계하며 자동으로 숨기지 않습니다.
