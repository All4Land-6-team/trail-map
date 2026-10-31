# 공식 시설 공통 전처리와 코스 상세 연동

Issue #75는 #66 음수대와 #67 쉼터의 로컬 구현·선별 기준·테스트를 이어받는다.
`feature/66-facility-drinking-water`의 API·화면·CSV 처리와
`feature/67-facility-shelters`의 쉼터 전처리를 산 소속 판정과 통합했다.
Issue #81부터 신규 후보는 모든 산의 경계에서 정확히 한 곳과 일치해야 적재 대상이 된다.
기존 작업 폴더의 미커밋 파일은 변경하지 않았다.

## 처리 흐름

`원본 3개 → 출처별 후보 선택 → 공통 검증 → 같은 DB 스냅샷에서 산 소속 판정 → 출처별 JSON v2 → Java 적재 → 코스 주변 API → 지도·목록`

| 입력 | 출력 | 현재 원본 후보 |
| --- | --- | ---: |
| 화장실 SHP | restrooms.json | 화장실 95개 |
| 샘터 CSV | springs.json | 음수대 1개 |
| 기타구축물 CSV | structures.json | 음수대 3개 + 쉼터 5개 |

`report.json`에는 출처별 보고서와 유형별 총건수를 기록한다. 기타구축물은 같은 CSV를 두 선별 규칙으로 검사하므로 `report.byType`의 제외 건수를 합산하지 않는다. 같은 출처만 합치며, 같은 원본 ID의 내용이나 유형이 충돌하면 실패한다.

좌표·필수값·중복 검증은 `contract.py`, CSV 식별자·후보 범위는 `csv_common.py`, 파일 저장은 `document.py`를 공유한다. CSV의 기존 `csv-...` 및 `reviewed-deokjaesaem`, SHP의 `OBJECTID`와 원본 필드는 유지한다. 개별 어댑터의 JSON v1 생성 명령도 후보 검토용으로 유지한다.

산 소속은 `mountain_membership.py`의 `ST_Covers`로 판정한다. 정확히 한 산의 경계 내부·경계선에 있는 신규 후보만 해당 산 ID로 출력한다. 경계 밖·경계가 없는 산·두 산 이상과 일치한 후보·동일 출처의 기존 시설은 제외하며 보고서에 사유를 남긴다. 유효하지 않은 경계·DB 오류는 실패로 처리한다. 세 출처를 같은 읽기 전용 REPEATABLE READ 트랜잭션에서 판정하고, 모든 판정이 성공한 뒤 파일을 저장한다. 입력/판정 실패 시 기존 출력을 교체하지 않는다. 출력은 파일 단위로 원자적으로 교체하며, 저장 도중 디스크 오류가 나면 명령을 재실행해야 한다.

## 전처리 실행

Python 3.12 이상, PostgreSQL/PostGIS, Java 21, Node 24를 사용한다. 프로젝트 루트 PowerShell에서 시설용 가상환경을 준비한다.

    python -m venv data-pipeline/.venv-facility
    & data-pipeline/.venv-facility/Scripts/python.exe -m pip install -r data-pipeline/requirements-facility.txt

원본은 Git에서 제외되는 프로젝트 `data/raw/`에 둔다. 아래 경로는 기존 로컬 데이터 폴더의 예이며 실제 파일 위치에 맞게 지정한다. DB 비밀번호는 환경 변수나 pgpass로 설정한다. 코드가 루트 `.env`를 자동으로 읽지는 않는다.

    $env:PYTHONPATH = 'data-pipeline/src'
    $env:PGHOST = 'localhost'
    $env:PGPORT = '5432'
    $env:PGDATABASE = 'trail_map'
    $env:PGUSER = 'postgres'
    $env:PGPASSWORD = $env:DB_PASSWORD
    & data-pipeline/.venv-facility/Scripts/python.exe -m trail_map_data.facilities.pipeline --restrooms 'D:/Project/trail-map/data/raw/knps/restrooms/국립공원공단_국립공원 화장실 공간데이터_20141219/GSTN_TOILET_PT.shp' --springs 'D:/Project/trail-map/data/raw/knps/drinking-water/springs/GSTN_SPRG_PT.csv' --structures 'D:/Project/trail-map/data/raw/knps/drinking-water/structures/국립공원공단_기타구축물_20240911.csv' --output-dir 'D:/Project/trail-map/data/processed/knps/facilities'

기존 출력 교체는 `--overwrite`를 명시한다. 산 ID 기본값은 없으며 DB의 모든 유효한 경계와 비교한다. `--park-code`는 1501, `--encoding`은 cp949다. 원본 날짜는 `--restroom-date`, `--spring-date`, `--structure-date`로 지정한다. 날짜나 원본을 변경하면 선별 결과도 다시 검토한다. 후보가 없는 자료는 기존 어댑터와 같이 실패한다.

## 출처별 적재

`backend` 폴더의 별도 터미널에서 실행한다. 이 명령은 **DB에 저장한 뒤 종료**하며 웹 서버를 계속 띄우지 않는다. `report.json`은 적재 대상이 아니다.

    .\gradlew.bat bootRun --args='--spring.main.web-application-type=none --facility.import.enabled=true --facility.import.file=D:/Project/trail-map/data/processed/knps/facilities/restrooms.json'
    .\gradlew.bat bootRun --args='--spring.main.web-application-type=none --facility.import.enabled=true --facility.import.file=D:/Project/trail-map/data/processed/knps/facilities/springs.json'
    .\gradlew.bat bootRun --args='--spring.main.web-application-type=none --facility.import.enabled=true --facility.import.file=D:/Project/trail-map/data/processed/knps/facilities/structures.json'

각 출처는 독립 트랜잭션이다. 세 명령이 모두 성공한 뒤 조회를 확인한다. 기존 행은 출처·원본 ID로 찾아 건너뛰고 산 소속도 변경하지 않는다. `mountainId`는 기존 원본 해시 계산에서 제외한다. 시설 ID·원본 해시·적재 시각·제보 참조를 유지하며 원본 변경은 해당 파일 전체를 거부한다. 전체 DB를 초기화하거나 기존 행을 삭제하지 않는다.

## 프론트와 백엔드 동시 실행

터미널 두 개를 사용한다. 두 터미널 모두 **현재 #75 브랜치의 작업 폴더**를 사용해야 한다. JDK 21과 Node 24를 PATH에 설정하고 백엔드에는 `DB_PASSWORD`를 전달한다.

백엔드 터미널 (`backend`):

    .\gradlew.bat bootRun --args='--facility.review.enabled=true'

프론트 터미널 (`frontend`):

    npm ci
    npm run dev -- --port 5173 --strictPort

일반 코스 조회만 확인한다면 백엔드의 검토 옵션은 생략할 수 있다. 5173이 사용 중이면 실행이 실패하며 5174로 전환하지 않는다. 기본 API 주소는 `http://localhost:8080`, CORS 허용 주소는 `http://localhost:5173`이다. 개발용 검토 API는 로컬 개발 환경에서만 활성화한다.

## 조회와 화면

- 코스 주변: `/api/v1/courses/{courseId}/facilities?type=SHELTER&radiusMeters=250` 또는 `DRINKING_WATER`, `RESTROOM`
- 시설 상세: `/api/v1/facilities/{facilityId}`
- 개발용 전체 검토: `/api/v1/facilities/review?sourceId={sourceId}&type=SHELTER`
- 백운대 쉼터 탭: `http://localhost:5173/#mountains/bukhansan/courses/bukhansan-baegundae?tab=spots&category=shelter`
- 기타구축물 쉼터 전체 검토: `http://localhost:5173/?preview=facilities&sourceId=7&type=SHELTER`
- 기타구축물 음수대 전체 검토: `http://localhost:5173/?preview=facilities&sourceId=7&type=DRINKING_WATER`
- 샘터 전체 검토: `http://localhost:5173/?preview=facilities&sourceId=6&type=DRINKING_WATER`

출처 ID는 로컬 DB의 적재 로그 기준이며 다른 DB에서는 달라진다. 검토 화면은 DEV에서만 연결되고 운영 번들에는 포함되지 않는다.

코스 API는 저장된 시설·코스의 산 ID가 같고, Point와 코스 전체 LineString의 최단거리가 지정 반경 이내인 시설을 반환한다. 거리는 요청 시 계산하며 경계 판정을 반복하지 않는다. 코스별 연결 목록을 미리 저장하는 방식이 아니다. 상세·출처별 검토 조회는 산 소속·코스 거리로 필터링하지 않는다.

쉼터·음수대·화장실과 전체 탭은 같은 API 결과를 사용한다. 유형마다 요청 취소·코스/유형/재시도 키를 관리하고, 로딩·오류·미연결·0건을 구분한다. 전체 탭에서 일부 유형이 실패해도 성공한 목록을 유지하며 전체 개수를 확정하지 않는다. 세 시설의 mock 항목은 실패 시에도 표시하지 않는다. 사진 스팟만 기존 예시를 유지한다.

지도·목록의 ID는 `facility-{facilityId}`이고 원본 좌표를 그대로 사용한다. 목록 선택은 지도 위치를 선택하며 공식 시설의 커뮤니티 후기 연결은 #71 범위다. 샘터·약수터는 하위 카테고리 없이 음수대로 표시하며 원본 기준일과 현재 이용/음용 적합 여부를 구분한다.

## 검증

프로젝트 루트에서 PG* 설정 후:

    $env:FACILITY_TEST_DATABASE = '1'
    & data-pipeline/.venv-facility/Scripts/python.exe -m pytest data-pipeline/tests/test_facilities.py data-pipeline/tests/test_drinking_water.py data-pipeline/tests/test_shelters.py data-pipeline/tests/test_mountain_membership.py data-pipeline/tests/test_facility_pipeline.py -q

`backend`에서:

    $env:FACILITY_TEST_JDBC_URL = 'jdbc:postgresql://localhost:5432/trail_map'
    $env:FACILITY_TEST_DB_USERNAME = 'postgres'
    $env:FACILITY_TEST_DB_PASSWORD = $env:DB_PASSWORD
    .\gradlew.bat test bootJar

`frontend`에서:

    node --test tests/*.test.mjs tests/*.test.cjs
    npm run lint
    npm run build

Python 공간 테스트는 임시 테이블, Java 시설 테스트는 롤백되는 데이터를 사용한다. 세 유형의 같은/다른 산·반경 안/밖·미소속 조회, 재적재, 기존 ID·해시·제보 참조 보존을 확인한다. 프론트 컴포넌트 렌더링 테스트는 상태별 HTML 출력을 검증한다.

### 로컬 검증 기록 (2026-10-27)

- 당시 Python 62개 통과. 당시 판정 규칙의 내부·외부·경계선·경계 NULL, 출처 병합·동일 결과 재생성·DB 실패 시 기존 출력 보존 포함.
- 프론트 전체 테스트 90개 통과. 린트와 운영 빌드 통과.
- Docker Desktop과 Java 21에서 백엔드 전체 테스트 79개 통과, 실패·생략 0개. 실제 PostGIS 시설 테스트 10개와 bootJar 성공.
- 최초 적재: 출처 4는 95개 건너뜀, 출처 6은 1개 건너뜀, 출처 7은 기존 음수대 3개를 유지하고 쉼터 5개 추가.
- 두 번째 적재: 세 출처 모두 inserted=0, updated=0, skipped=95/1/8.
- 적재 전후 기존 시설 99개 행의 전체 값이 동일하며 총 104개다. 실제 facility_report는 전후 0개로 동일하고, 제보가 존재하는 경우의 참조 보존은 Java 통합 테스트로 확인했다.
- 실제 시설 104개 상세 응답의 ID·좌표·산 ID와 출처별 검토 건수 95/1/3/5를 확인했다.
- 코스 2·250m 조회: 화장실 4개, 음수대 0개, 쉼터 0개. CORS와 프론트 5173 HTTP 응답 정상.

## 실제 경계와 코스 연결 후

2026-10-28 로컬 DB에 적용한 축소 버퍼는 공식 원본 경계가 아닌 추정 경계다. 버퍼 없는 실제 경계 확보와 북한산·도봉산 산 ID 분리는 후속 작업이다. 경계가 없는 산에는 새 시설의 기본 소속을 할당하지 않는다.

경계를 입력한 뒤 새 후보에 공통 전처리·출처별 적재를 실행한다. 기존 시설의 소속은 이 과정에서 바뀌지 않는다. 실제 코스 연결 시 `Course.backendCourseId`와 지도 경로를 동일 DB 코스에서 제공해야 한다. 현재 백운대 DB 코스 2는 mock 경로이므로 250m 안에 쉼터·음수대가 없을 수 있다. 결과를 만들기 위해 반경이나 원본 좌표를 변경하지 않는다.
