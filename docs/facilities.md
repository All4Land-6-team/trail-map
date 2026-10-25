# 공식 시설 데이터 시범 적재와 조회

현재 시범 원본은 국립공원공단의 2014-12-19 화장실 SHP다. `PO_CD=1501`은 북한산국립공원권 코드이므로 북한산과 도봉산이 함께 포함된다. 95건은 지역을 확정하기 위한 후보이며, 최종 서비스 대상은 북한산이다. 지역 검토가 끝나기 전에는 이 후보 데이터를 운영 DB로 옮기지 않는다.

## 파일 흐름

`data/raw/knps/restrooms/.../GSTN_TOILET_PT.shp` → `data-pipeline/src/trail_map_data/facilities/knps_restrooms.py` → `facilities/contract.py` 검증 → `data/processed/knps/restrooms/candidates.json` → `FacilityImportRunner` → `FacilityImportService` → `FacilityImportRepository` → `data_source`, `facility` 순서로 저장한다.

조회는 `FacilityController` 또는 `FacilityReviewController` → `FacilityService` → `FacilityRepository` 순서다. SQL은 Repository에 있으며 트랜잭션은 Service에서 관리한다. Python은 DB에 연결하지 않는다.

새 원본 형식이 들어오면 읽기·좌표 변환 어댑터를 추가하고 같은 공통 JSON을 출력한다. Java 적재 코드는 SHP, CSV 같은 원본 구조를 알 필요가 없다. DEM·Terrain 전처리 CLI는 그대로 사용할 수 있다.

## 공통 JSON v1

```json
{
  "schemaVersion": 1,
  "source": {
    "name": "출처 이름", "provider": "제공 기관", "url": null,
    "format": "SHP", "crs": "EPSG:4326", "version": "20141219"
  },
  "facilities": [{
    "sourceRecordId": "323", "type": "RESTROOM", "name": "시설 이름",
    "longitude": 127.0, "latitude": 37.6,
    "sourceReportedStatus": "USE_YN=1", "sourceDate": "2014-12-19"
  }],
  "report": {}
}
```

시설 좌표는 항상 WGS84(EPSG:4326)의 경도·위도 순서다. `source.crs`는 변환 전 원본 CRS다. `RESTROOM`, `SHELTER`, `DRINKING_WATER` 유형을 지원하지만 실제 데이터 적재는 화장실로 검증한다. 출처 URL을 확인하지 못했으면 `null`로 둔다.

`sourceRecordId`에는 SHP의 `OBJECTID`를 문자열로 보존한다. `ID_CD`나 좌표를 식별자로 쓰지 않는다. 서로 다른 OBJECTID가 같은 좌표에 있어도 보존한다. `USE_YN`은 자료 당시 값이며 현재 개방·운영 여부를 뜻하지 않는다. 응답에서도 `sourceReportedStatus`와 `sourceDate`를 함께 제공한다.

## 전처리 실행

프로젝트 루트의 PowerShell에서 다음 명령을 실행한다.

```powershell
python -m venv data-pipeline/.venv-facility
& data-pipeline/.venv-facility/Scripts/python.exe -m pip install -r data-pipeline/requirements-facility.txt
$env:PYTHONPATH = 'data-pipeline/src'
& data-pipeline/.venv-facility/Scripts/python.exe -m trail_map_data.facilities.knps_restrooms `
  'data/raw/knps/restrooms/국립공원공단_국립공원 화장실 공간데이터_20141219/GSTN_TOILET_PT.shp' `
  'data/processed/knps/restrooms/candidates.json' --park-code 1501
```

`.prj`를 읽어 WGS84로 변환한다. CRS가 없으면 임의로 추정하지 않는다. `report`에서 전체 건수, 코드 선택 건수, 적재 가능 건수, 제외 사유와 선택된 행의 오류를 확인한다. 같은 ID·같은 내용은 중복 제외하고, 같은 ID의 내용이 서로 다르면 전처리를 중단한다. 기존 가공 파일을 바꾸려면 `--overwrite`를 명시한다.

## JDBC 적재

PostgreSQL/PostGIS와 `trail_map` DB가 준비되어 있어야 한다. DB 비밀번호는 환경 변수 `DB_PASSWORD` 또는 Git에서 제외된 `backend/src/main/resources/application-secret.properties`에 설정한다. 프로젝트 루트 `.env`는 Spring Boot가 자동으로 읽지 않는다.

`backend` 디렉터리에서 실행한다. 아래 경로는 현재 로컬 프로젝트 위치의 예다.

```powershell
$env:TERRAIN_ROOT_PATH = 'D:/Project/trail-map/data/processed/dem/bukhansan/terrain'
.\gradlew.bat bootRun --args='--spring.main.web-application-type=none --facility.import.enabled=true --facility.import.file=D:/Project/trail-map/data/processed/knps/restrooms/candidates.json'
```

적재 실행은 완료 후 종료하며 `sourceId`, `total`, `inserted`, `skipped`를 로그에 출력한다. 일반 서버 실행에서는 적재기가 동작하지 않는다. 출처와 시설 저장은 한 트랜잭션이며 실패 시 전부 롤백한다.

출처 이름·제공 기관·형식·버전으로 같은 출처를 찾는다. 동시에 실행한 적재기가 출처를 중복 생성하지 않도록 PostgreSQL 트랜잭션 advisory lock을 사용한다. `(source_id, source_record_id)`로 시설을 식별하고 공통 필드의 SHA-256을 비교한다. 같은 데이터의 재적재는 건너뛰며, 같은 원본 ID의 내용이 달라졌으면 기존 행을 수정하지 않고 적재를 실패시킨다.

C는 최초 출처·시설 적재이고 R은 검토 목록·상세·코스 주변 조회다. U는 없다. D는 지도 검토 후 도봉산으로 확정한 OBJECTID에 대해 별도 확인 후 수행한다. 재적재하면 삭제한 후보가 다시 들어오므로, 최종 제외 목록을 전처리에 반영하기 전에는 원래 95건을 다시 적재하지 않는다. 범용 수정·삭제 HTTP API는 제공하지 않는다.

## 조회 API

서버의 context path는 `/api`다.

| 요청 | 동작 |
| --- | --- |
| `GET /api/v1/facilities/{facilityId}` | 좌표·유형·원본 기준일·상태·출처를 조회한다. |
| `GET /api/v1/courses/{courseId}/facilities?type=RESTROOM&radiusMeters=250` | 코스 전체 LineString까지의 최단 거리가 지정 반경 이내인 시설을 거리순으로 조회한다. |
| `GET /api/v1/facilities/review?sourceId=1&type=RESTROOM` | 명시한 출처의 후보를 GeoJSON FeatureCollection으로 반환한다. |

`type`은 생략할 수 있다. 반경은 미터 단위로 1~5000이며 기본값은 250이다. 존재하지 않는 코스·시설·출처에는 404, 잘못된 조회 조건에는 400을 반환한다. 코스 주변 조회는 `ST_DWithin`/`ST_Distance`의 geography 연산을 사용하며 `mountain_id`가 없는 시설도 좌표로 판정한다. 실제 `course` 데이터가 없으면 404다. 산 경계 안에 있는지를 판정하는 기능은 아니다.

검토 API는 기본적으로 꺼져 있다. 로컬에서 다음과 같이 켜고 적재 로그의 `sourceId`로 조회한다.

```powershell
.\gradlew.bat bootRun --args='--facility.review.enabled=true'
```

검토 API는 응답을 공통 성공 래퍼로 감싸지 않는 표준 GeoJSON이다. 각 Feature의 `id`는 facility ID이고 `properties.sourceRecordId`는 삭제 대상을 대조할 때 사용할 OBJECTID다. 별도의 프론트엔드 지도 화면은 이 작업에 포함하지 않는다.

현재 공간조회는 소량 시범 데이터에 대해 geography 거리 연산을 수행한다. 전체 시설 수가 늘면 실행 계획을 확인한 뒤 geography 표현식 인덱스를 별도 migration으로 추가할 수 있다. 기존 V1·V2 migration은 변경하지 않는다.

## 검증

```powershell
# 프로젝트 루트에서 Python 검증
& data-pipeline/.venv-facility/Scripts/python.exe -m pytest data-pipeline/tests/test_facilities.py
# backend에서 일반 단위 테스트
.\gradlew.bat test
```

실제 PostGIS 적재·GeoJSON·거리 조회를 함께 검증하는 테스트는 `FACILITY_TEST_JDBC_URL`, `FACILITY_TEST_DB_USERNAME`, `FACILITY_TEST_DB_PASSWORD`를 설정하고 `FacilityPostgisIntegrationTest`를 실행한다. JDBC URL을 명시하지 않으면 이 테스트는 생략한다. 반드시 개발용 DB를 지정한다. Flyway가 해당 DB에 스키마를 준비하며 테스트가 만든 데이터는 각 테스트 종료 시 롤백된다.

```powershell
$env:FACILITY_TEST_JDBC_URL = 'jdbc:postgresql://localhost:5432/trail_map'
$env:FACILITY_TEST_DB_USERNAME = 'postgres'
$env:FACILITY_TEST_DB_PASSWORD = $env:DB_PASSWORD
.\gradlew.bat test --tests '*FacilityPostgisIntegrationTest'
```

좌표 변환·좌표 오류·필수값·중복 ID·원본 상태 보존·같은 좌표의 서로 다른 시설·재적재·변경 거부·코스 중간 선까지의 거리·유형 필터·잘못된 요청을 검증한다. 원본, 가공 파일, `.env`, 가상환경은 Git에 포함하지 않는다.
