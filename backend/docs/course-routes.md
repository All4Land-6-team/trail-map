# 코스 LineString 조회 및 후보 데이터 적재 (#95)

`course.course_geometry`를 재사용하며 고도·경사 분석은 생성/수정하지 않는다.
신규 V7은 데이터셋 지문과 코스별 경유지·검증 상태를 보관한다. 기존 시드 코스,
후기, 일정 및 분석 결과를 변경하거나 삭제하지 않는다.

## 입력과 한계

원본은 Git 제외 경로 `data/raw/courses/bukhansan-13-20261031/bukhansan_13_courses.geojson`이다.
사용자 제공 GPX/국립공원공단 참고 경로를 재구성한 후보이며 공식 S-Map 경로로 검증된 데이터가 아니다.
첨부 README, validation.json, 원본 ZIP도 같은 로컬 데이터 폴더에서 함께 보관한다.
`candidate_smap_unverified`, `check_note`, `via`를 그대로 API에 전달한다.
비봉의 안내 거리 차이, 백운대 하루재 경로 차이, 사패산 왕복 중첩 등 원본 주의사항은 해소되지 않았다.
`official_km`은 제공 파일의 공식 안내 거리 주장값이며 측정 거리로 덮어쓰지 않는다.

입력은 최대 64 MiB, 정확히 BUKHAN_01~13의 고유 Feature 13개로 제한한다.
LineString은 EPSG:4326 `[경도, 위도]` 2차원 유한 좌표로 최소 2개여야 한다.
legacy `crs`가 있다면 첨부 파일의 CRS84만 허용한다. 연속 중복 좌표만 제거하고
왕복·교차 경로는 보존한다. 난이도·시간·고도는 추측해서 채우지 않는다.

국립공원 범위와 산을 구분하여 BUKHAN_03~07은 도봉산, 나머지 8개는 북한산에 매핑한다.
두 산의 **실제 DB ID를 확인해서** 명시적으로 전달해야 한다. 적재기가 산을 임의 생성하지 않는다.

```sql
SELECT mountain_id, mountain_name, source_record_id FROM mountain ORDER BY mountain_id;
```

산 행이 없으면 기존 개발용 시드 문서를 참고해 개발 데이터를 준비하거나 프로젝트의
산 데이터 적재 절차로 먼저 등록한다. 다른 환경의 산 ID를 그대로 복사하지 않는다.

## 실행

백엔드 디렉터리에서 실행한다. DB 환경 변수/비밀 설정은 기존 프로젝트 방식을 따른다.
원본 데이터를 저장소에 커밋하지 않는다. CLI는 웹 서버 모드에서는 실행을 거절한다.

```sh
bash gradlew bootJar
java -jar build/libs/trail-map-backend-0.0.1-SNAPSHOT.jar \
  --spring.main.web-application-type=none \
  --course-route.import.enabled=true \
  --course-route.import.file=/absolute/path/to/bukhansan_13_courses.geojson \
  --course-route.import.bukhansan-mountain-id=<북한산_DB_ID> \
  --course-route.import.dobongsan-mountain-id=<도봉산_DB_ID>
```

데이터셋 키 `bukhansan-13-candidate`는 안정적으로 유지하며 파일 SHA-256을 출처 버전으로 기록한다.
전체 적재는 단일 트랜잭션이다. advisory transaction lock 및 데이터셋/코스 유일 제약으로
동시 재실행을 직렬화한다. 동일 바이트 파일·산 매핑을 재실행하면 코스 ID가 유지되고
`inserted=0, existing=13`이다. 파일 내용·산 매핑 또는 DB 코스가 달라지면 `ROUTE_409_1`로
거절하며 자동 덮어쓰기/버전 승격을 하지 않는다. 새 데이터 버전 도입은 별도 검토 작업이다.

## 조회 API

사용자 헤더 없이 기존 `SuccessResponse.data`로 반환한다.

- `GET /api/v1/course-routes?mountainKey=bukhansan`: 적재된 북한산 후보 8개. `dobongsan`은 5개.
- `GET /api/v1/courses/{courseId}/route`: DB 코스 ID 기준 단일 경로. 기존 코스도 조회 가능.

공통 필드: `courseId`, `mountainId`, `mountainKey`, `courseName`, `courseVersion`,
`routeLabel`, `distanceMeters`, `officialDistanceMeters`, `durationSeconds`, `difficulty`,
`geometry: {type: "LineString", coordinates: [[경도, 위도], ...]}`,
`source: {name, provider, url, version, recordId, validationStatus, checkNote}`.

`distanceMeters`는 현재 geometry의 PostGIS geography 길이(m)이며 3D 산행 거리가 아니다.
`officialDistanceMeters`는 별도 안내 거리, `durationSeconds`는 초, 미확인 난이도·시간은 null이다.
등록 전 목록은 빈 배열이며 시드/가짜 경로로 대체하지 않는다. 기존 메타데이터 없는 코스는
`validationStatus=UNKNOWN`, 산 키는 기존 산 `source_record_id` 또는 DB ID 문자열이다.
알 수 없는 코스는 404, 양수가 아닌 ID/지원하지 않는 산 키/누락된 산 키는 400이다.

## 검증

```sh
bash gradlew test --tests '*courseroute.*'
ROUTE_SAMPLE_GEOJSON=/absolute/path/to/bukhansan_13_courses.geojson \
  bash gradlew test --tests '*CourseRouteDocumentReaderTest' --rerun-tasks
ROUTE_TEST_JDBC_URL=jdbc:postgresql://localhost:5432/trail_map \
  ROUTE_TEST_DB_USERNAME=postgres ROUTE_TEST_DB_PASSWORD=... \
  bash gradlew test --tests '*CourseRoutePostgisIntegrationTest' --rerun-tasks
```

PostGIS 테스트는 명시한 개발 DB에만 접속한다. 고유한 임시 스키마 안에서 V2~V7을 적용하고
13개 적재·재적재·산별 분리·GeoJSON·거리·변경 거절을 검증한 뒤 스키마/행을 모두 롤백한다.
public의 기존 코스/분석은 읽거나 변경하지 않는다. PostGIS 확장이 설치된 개발 DB와
테스트 스키마 생성 권한이 필요하다.

### 로컬 통합 확인 (2026-10-31)

- 제공 파일 SHA-256: `3044550246d9f61425d5ca17bcfdcfba5f74d7a29667ff70e602f1b03dcd2b47`
- 실제 적재: 북한산 8개, 도봉산 5개. 연속 중복 좌표 1개만 제거하여 총 6,887개 좌표를 보관했다.
- 동일 파일 재적재: `inserted=0, existing=13`, 기존 코스 ID 유지.
- 13개 목록·상세 응답의 좌표 순서와 개수를 원본과 대조했다. `ST_AsGeoJSON` 소수 9자리
  출력에 따른 좌표 차이는 축별 `5.1e-10`도 이하이며, 목록과 상세의 geometry는 동일했다.
- 실제 앱에서 산별 목록, 선택 코스 변경, 상세 진입, 2D/3D 전환 및 하단 시트 조절을 확인했다.
  분석 결과가 없는 상태에서도 원본 LineString을 표시하며 분석 수치는 빈 상태로 유지한다.
- 프론트 전체 테스트 156개, lint 및 프로덕션 빌드 통과. 기존 대형 번들 경고는 남아 있다.
- 백엔드 전체 테스트 194개 중 167개 통과·27개 조건부 건너뜀, `bootJar` 성공.
  이번 경로의 실제 파일·PostGIS 검증은 실행했으며, 건너뛴 항목은 별도 입력/접속 설정이
  필요한 기존 분석·비교·시설 테스트다.

테스트 결과는 위 시점의 로컬 환경 기준이다. 다른 환경에서는 산 ID 확인과 원본 파일 전달 후
적재 절차를 다시 실행해야 한다. 데이터 파일과 로컬 DB 자체는 Git에 포함되지 않는다.
