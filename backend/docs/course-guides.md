# 공식 코스 안내 정보 (#107)

경로 GeoJSON과 공식 탐방 안내는 별도 입력이다. 경로가 있어도 소요 시간·난이도·DEM 분석이 자동으로 생기지는 않는다.

## 입력과 기준

- 국립공원공단의 **코스 전체 난이도** `하/중/상`을 `BEGINNER/INTERMEDIATE/EXPERT`에 연결한다. UI는 `초급/중급/고수`다.
- 구간별 5단계 난이도 이미지와 전체 3단계 등급을 혼용하지 않는다. 임의 계산·빈 등급 추정·고수 코스 강제 배분은 하지 않는다.
- 2026-11-01 공식 페이지의 13개 코스 요약을 확인한 입력은 초급 8개·중급 5개다. 북한산은 초급 3개·중급 5개, 도봉산은 초급 5개다. 고수 결과가 없는 것은 정상이다.
- 거리·시간은 안내된 구간 기준이지 왕복을 뜻하지 않는다. 경로의 구면 길이와 안내 거리를 구분한다.
- 등급이 낮아도 코스 내 위험 구간이 없다는 뜻은 아니다. 최신 입산시간·통제 정보는 공식 안내에서 별도로 확인한다.

공식 페이지 예: [백운대 코스](https://www.knps.or.kr/front/portal/visit/visitCourseSubMain.do?menuNo=8000275&parkId=121500&parkNavGb=guide&vcursId=121500V008).

## 팀원 실행

1. 최신 마이그레이션(V8)을 적용하고 #95의 동일 GeoJSON 13개를 먼저 적재한다.
2. 전달받은 안내 JSON을 프로젝트 루트의 `data/processed/course-guides/bukhansan-13-knps-20261101.json`에 둔다. 원본·가공 데이터는 Git에 넣지 않는다.
3. DB 비밀 설정을 준비하고 `backend`에서 실행한다.

```sh
bash gradlew test bootJar
java -jar build/libs/trail-map-backend-0.0.1-SNAPSHOT.jar \
  --spring.main.web-application-type=none \
  --course-guide.import.enabled=true \
  --course-guide.import.file=../data/processed/course-guides/bukhansan-13-knps-20261101.json
```

Windows에서는 `gradlew.bat`과 해당 절대 경로를 사용한다. 기존 Terrain 설정이 상대 경로 오류를 내면 `TERRAIN_ROOT_PATH`를 타일 폴더의 절대 경로로 지정한다.

JSON 계약: `schemaVersion=1`, `datasetKey=bukhansan-13-candidate`, `courses` 13건.
각 항목은 `routeRecordId`, `mountainKey`, `routeHash`, `officialCourseId`, `routeLabel`,
`difficultyGrade`, `distanceMeters`, `durationSeconds`, `sourceUrl`, `checkedOn`이다.
`routeHash`는 #95 적재 시의 `course.source_hash`이며, 팀원의 로컬 숫자 코스 ID를 복사하지 않는다.

적재기는 기존 구간명·안내 거리·산 키·입력 경로 지문·버전 1이 일치하는 코스에만 누락된 시간과 난이도를 채운다.
한 항목이라도 충돌하면 전체 트랜잭션을 롤백한다. 기존 시간·난이도는 덮어쓰지 않는다.
동일 JSON 재실행은 `inserted=0, existing=13`이며 변경된 파일은 검토 없이 덮어쓰지 않는다.
공식 안내가 바뀌면 기존 입력을 몰래 수정하지 말고 별도 갱신 절차를 검토한다.

## 저장·조회·화면

- `course`: 기존 공식 거리, 공식 소요 시간, 전체 난이도.
- `course_guide_metadata`: 연결한 코스 버전·경로 지문, 공식 코스 ID·구간·등급·거리·시간, URL·확인일, 입력 SHA-256.
- 기존 `course.source_id`, 후보 검증 상태, LineString, 코스 버전, 분석 결과는 변경하지 않는다.
- 경로 API 응답에 nullable `guide`를 추가한다. 버전·지문·거리·시간·등급이 일치할 때만 출처를 함께 반환한다.
- 목록의 기존 시간·난이도 필터를 그대로 사용한다. 상세는 기본 정보와 분석을 분리해, 분석이 없어도 경유 구간·등급·시간·두 종류의 거리를 표시한다.
- 후기·시설·통제·고도·경사 분석 API는 기존 담당 구현을 유지한다. 분석이 없으면 값을 만들어 넣지 않는다.

## 확인

```sh
# backend: 격리된 임시 스키마에서 실행하고 전체 롤백
ROUTE_TEST_JDBC_URL=jdbc:postgresql://localhost:5432/trail_map \
ROUTE_TEST_DB_USERNAME=YOUR_LOCAL_USER bash gradlew test

# frontend
npm run test:course-routes
npm run test:course-detail
npm run test:courses
npm run lint
npm run build
```

로컬 DB에 병합 전 `V5__add_course_route_catalog.sql`이 남아 있다면 먼저 [마이그레이션 주의사항](migration.md)을 확인한다.
백업과 체크섬 검증 없이 이력을 지우거나 `repair`하지 않는다. 이번 환경은 전체 백업 후 동일 SQL인 코스 이력을 V7로 바꾸고,
한 번만 `spring.flyway.out-of-order=true`로 누락된 V5·V6을 적용했다. 일반 실행 설정에는 이 옵션을 추가하지 않았다.

시설 CSV는 이 코스 안내 적재와 별개다. 공유 CSV의 산·출처 숫자 ID는 각 DB에서 다른 의미일 수 있으므로 매핑 확인 전 적재하지 않는다.
