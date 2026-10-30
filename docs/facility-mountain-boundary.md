# 산 경계 기반 시설 소속

시설별 후보 JSON을 입력받아 DB에 저장된 산 경계로 **신규 시설만** 판정한다. 산 ID의 기본값은 없다.

## 판정 규칙

| 상태 | 적재 결과 | 보고서 건수 |
| --- | --- | --- |
| 정확히 한 산의 경계 내부 | 일치한 산의 ID로 저장 | inside |
| 정확히 한 산의 경계선 위 | 일치한 산의 ID로 저장 | onBoundary |
| 경계 외부·폴리곤 구멍 내부·유효한 경계 없음 | 제외 | outside |
| 두 산 이상의 경계에 포함 | 제외 | multipleMatches |
| 동일 출처·원본 ID의 기존 시설 | 판정·변경 없이 제외 | existing |
| DB 오류·유효하지 않은 경계 | 결과 생성 실패 | — |

[ST_Covers](https://postgis.net/docs/ST_Covers.html)는 경계선 위의 Point도 포함한다. 구멍의 경계는 포함하고 구멍 내부는 제외한다. 좌표는 EPSG:4326이다. 잘못된 도형은 판정 전에 거부한다.

`report.mountainMembership`에 산별 EWKB fingerprint, 판정·제외 건수와 각 제외 사유를 기록한다. 기존 시설 조회와 경계 판정은 같은 읽기 전용 REPEATABLE READ 스냅샷에서 실행한다. 기존 원본 보고서는 유지한다.

경계 밖이거나 여러 산에 걸친 후보는 결과 시설 배열에 넣지 않는다. 모든 후보가 제외되면 빈 시설 배열을 출력한다. 기존 시설의 산 소속은 경계가 바뀌어도 다시 계산하거나 갱신하지 않는다.

## 실행

세 원본을 함께 처리할 때는 [공통 전처리 명령](facility-pipeline.md)을 사용한다. 아래 개별 판정 명령도 유지한다.

프로젝트 루트 PowerShell 기준이다. 시설 의존성을 설치하고 원래 어댑터로 후보 JSON을 생성한 다음 아래 단계를 실행한다. 화장실·음수대·쉼터 모두 같은 명령을 사용한다.

    $env:PYTHONPATH = 'data-pipeline/src'
    $env:PGHOST = 'localhost'
    $env:PGPORT = '5432'
    $env:PGDATABASE = 'trail_map'
    $env:PGUSER = 'postgres'
    $env:PGPASSWORD = $env:DB_PASSWORD
    & data-pipeline/.venv-facility/Scripts/python.exe -m trail_map_data.facilities.mountain_membership 'data/processed/knps/restrooms/candidates.json' 'data/processed/knps/mountain-membership/restrooms.json'

비밀번호는 기존 환경 변수나 pgpass 등 로컬 설정으로 전달한다. `.env`를 자동으로 읽지는 않는다. 입력·출력 경로는 달라야 하고 기존 출력 교체 시 `--overwrite`를 명시한다. 음수대 후보 `drinking-water/springs.json`, `drinking-water/structures.json`도 각각 동일하게 처리한다.

Java 적재기에는 이 명령이 만든 **JSON v2**를 전달한다. 이전 후보 JSON v1을 직접 적재할 수 없다. 자세한 적재 명령은 [시설 문서](facilities.md)를 참고한다.

## 신규 데이터 적재와 경계 변경

1. 사용할 경계를 EPSG:4326의 유효한 MultiPolygon으로 산 행에 저장한다.
2. 새로 수집한 후보 JSON에만 산 소속 전처리를 실행한다.
3. 결과 JSON v2를 Java 적재기로 적재한다.
4. 제외 사유와 inserted/skipped를 확인한다.

경계 입력이나 새 후보 적재는 기존 시설의 소속을 변경하지 않는다. Java 적재기는 동일 출처·원본 ID의 기존 행을 건너뛰며 원본 내용이 달라진 경우 파일 전체를 거부한다. 시설 ID, 산 ID, 원본 필드·해시, 적재 시각과 제보 참조를 보존한다.

코스 조회는 같은 산 소속과 반경 조건을 함께 사용하며 경계를 다시 계산하지 않는다. 상세·출처별 검토 조회는 외부 시설도 반환한다.

공원 전체 경계와 북한산·도봉산을 분리한 산별 경계는 다르다. 현재 로컬 산 ID 2의 추정 경계는 공원권 도형이므로, 산별 분리가 필요하면 각 산의 경계를 별도로 확보해야 한다.

## 실제 경계 자료 검토: 2026-10-25

2026-10-25 검토 당시 로컬 `국립공원공단_국립공원 공원경계_20231231/공원경계버퍼/BSI_NPK_BBNDR.shp`는 사용하지 않았다. 당시에는 DB 경계를 NULL로 유지했다.

- 실제 `.prj`는 EPSG:5179다.
- 북한산 속성은 NPK_CD=L999M001S009, CRT_YMD=20241230이다.
- XML에는 3 Kilometers Buffer 처리 이력이 있다.
- [공공데이터포털 원문](https://www.data.go.kr/data/15017313/fileData.do)의 설명과 실제 파일의 좌표계·기준일이 다르다.
- 포털에서 다시 받은 ZIP의 SHP·DBF·PRJ·XML도 로컬 자료와 바이트 단위로 동일하다.
- SHP SHA-256: `1fb91a6c978471bb6c2a93ded144b4f78cf1745b05f07857b0dfcd76c804ab4b`

다운로드는 Git에서 제외되는 `data/raw/knps/boundaries/portal-15017313/park-boundary.zip`에 보관했다. 실제 파일은 기존 프로젝트 `D:/Project/trail-map/data`에 있다. 이후 2026-10-28에 사용자의 결정으로 3km 안쪽 축소 도형을 로컬 DB에 저장했다. **버퍼 없는 원본 확보와 검증은 여전히 남아 있다.**

## 로컬 DB 추정 경계 적용: 2026-10-28

북한산 `NPK_CD=L999M001S009` 원본 버퍼를 EPSG:5179에서 PostGIS `ST_Buffer(geom, -3000)`으로 축소하고 EPSG:4326으로 변환했다. 축소 도형을 산 ID 2의 `mountain_boundary`에 유효한 MultiPolygon으로 저장했다. 면적은 약 88.87㎢이며 출처 행은 `data_source.source_id=41`이다. 이 값은 **공식 원본 경계가 아니라 추정 경계**다. 다른 DB에는 적용되지 않는다.

당시 기존 시설 104건(화장실 95, 음수대 4, 쉼터 5)의 산 소속을 한 차례 다시 판정했다. `ST_Covers` 기준 안쪽 101건은 `mountain_id=2`, 바깥쪽 화장실 3건은 `mountain_id=NULL`로 저장했다. 바깥쪽 시설 ID는 34·43·46이고, 출처 ID는 모두 4다. 기존 시설의 식별자와 원본 해시는 유지했다. 화장실 출처 적재 결과는 `inserted=0, updated=3, skipped=92`; 샘터는 `0/0/1`; 기타구축물은 `0/0/8`이었다. 이 작업은 현재 신규 시설 전용 적재 정책 이전에 수행했다.

## 검증

PostGIS용 PG* 환경 변수를 설정하고 프로젝트 루트에서 실행한다.

    $env:FACILITY_TEST_DATABASE = '1'
    & data-pipeline/.venv-facility/Scripts/python.exe -m pytest data-pipeline/tests/test_facilities.py data-pipeline/tests/test_mountain_membership.py

Python은 세션 임시 테이블을 사용한다. 내부·외부·경계선·겹친 경계·기존 행 제외·잘못된 도형·DB 실패를 확인한다. 실제 시설/산 데이터에는 쓰지 않는다. 위 환경 변수가 없으면 DB 테스트를 생략한다.

Java의 `FacilityPostgisIntegrationTest`는 기존 v1 해시 호환, 신규 소속 저장, 재실행 시 기존 시설의 산 ID·시설 ID·제보 참조 보존, 원본 변경 거부, 코스 주변 조회를 검증한다. 테스트 행은 롤백된다.

아래는 #69 작업 당시 검증 기록이다. #75의 104개 통합 결과는 [공통 전처리 문서](facility-pipeline.md)를 참고한다. 현재 신규 시설 판정 규칙과는 다르다.

2026-10-25 검증 당시 실제 후보는 화장실 출처 4의 95개, 샘터 출처 6의 1개, 기타구축물 음수대 출처 7의 3개였다. 당시 경계가 NULL이므로 99개 모두 boundaryUnset, mountainId=2이며 내부 판정 건수는 0이었다. 이 기록은 2026-10-28 재판정 전 상태다.

당시 실행 결과: Python 27개 통과, 실제 PostGIS 시설 통합 테스트 9개 통과. 전체 백엔드 테스트도 성공했으며 별도 환경이 필요한 일정·Testcontainers 테스트 6개는 생략되었다. 세 출처를 각각 두 번 적재해 inserted=0, updated=0, skipped=95/1/3을 확인했다. 기존 99개 행의 전체 값과 facility_report 건수는 재적재 전후 동일하다. 제보 참조 보존은 별도 통합 테스트에서 제보 행을 만들어 검증했다.

Issue #81 변경 검증: Python 시설 전처리·산 소속 테스트 24개 통과, PostGIS 시설 통합 테스트 10개 통과, 프론트엔드 빌드 성공.

과거 검증에서 임시 8081 서버의 코스 2·250m 조회는 화장실 4개, 음수대 0개였다. 출처 검토 조회는 95/1/3개, 기존 시설 상세도 정상 응답했다. 이 결과는 당시 코드와 DB의 기록이다.
