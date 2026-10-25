# 산 경계 기반 시설 소속

Issue #69의 공통 전처리는 시설별 후보 JSON을 입력받아 DB 경계로 산 소속을 판정한다. 기본 대상 산 ID는 요청에 따라 **2**다.

## 판정 규칙

| 상태 | mountainId | 보고서 건수 |
| --- | --- | --- |
| 경계 내부 | 대상 산 ID | inside |
| 경계선 위 | 대상 산 ID | onBoundary |
| 경계 외부·폴리곤 구멍 내부 | null | outside |
| 산 행은 있고 경계가 NULL | 대상 산 ID | boundaryUnset |
| 산 없음·DB 오류·유효하지 않은 경계 | 결과 생성 실패 | 기본값으로 대체하지 않음 |

[ST_Covers](https://postgis.net/docs/ST_Covers.html)는 경계선 위의 Point도 포함한다. 구멍의 경계는 포함하고 구멍 내부는 제외한다. 좌표는 EPSG:4326이다. 잘못된 도형은 판정 전에 거부한다.

`report.mountainMembership`에 산 ID·이름, 경계 설정 여부, EWKB fingerprint, 네 가지 건수와 전체 건수를 기록한다. 경계 조회와 판정은 같은 읽기 전용 REPEATABLE READ 스냅샷에서 실행한다. 기존 원본 보고서는 유지한다.

외부 후보도 결과에 남긴다. 전부 외부여도 시설 배열을 비우지 않으며 `mountainId: null`을 적재한다. 경계 미설정 기본 할당은 **실제 산 내부임을 공간적으로 확인했다는 뜻이 아니다.**

## 실행

프로젝트 루트 PowerShell 기준이다. 시설 의존성을 설치하고 원래 어댑터로 후보 JSON을 생성한 다음 아래 단계를 실행한다. 화장실·음수대·쉼터 모두 같은 명령을 사용한다.

    $env:PYTHONPATH = 'data-pipeline/src'
    $env:PGHOST = 'localhost'
    $env:PGPORT = '5432'
    $env:PGDATABASE = 'trail_map'
    $env:PGUSER = 'postgres'
    $env:PGPASSWORD = $env:DB_PASSWORD
    & data-pipeline/.venv-facility/Scripts/python.exe -m trail_map_data.facilities.mountain_membership 'data/processed/knps/restrooms/candidates.json' 'data/processed/knps/mountain-membership/restrooms.json' --mountain-id 2

비밀번호는 기존 환경 변수나 pgpass 등 로컬 설정으로 전달한다. `.env`를 자동으로 읽지는 않는다. 입력·출력 경로는 달라야 하고 기존 출력 교체 시 `--overwrite`를 명시한다. 음수대 후보 `drinking-water/springs.json`, `drinking-water/structures.json`도 각각 동일하게 처리한다.

Java 적재기에는 이 명령이 만든 **JSON v2**를 전달한다. 이전 후보 JSON v1을 직접 적재할 수 없다. 자세한 적재 명령은 [시설 문서](facilities.md)를 참고한다.

## 경계 변경 후 재판정

1. 검증된 실제 경계를 EPSG:4326의 유효한 MultiPolygon으로 산 행에 저장한다.
2. 기존 후보 JSON마다 산 소속 전처리를 재실행한다.
3. 결과 JSON v2를 Java 적재기로 재적재한다.
4. 보고서와 inserted/updated/skipped를 확인한다.
5. 모든 대상 출처의 적재 완료 후 코스 주변 조회를 확인한다.

경계 입력만으로 소속이 자동 변경되지는 않는다. 재적재 전까지 코스 API는 기존 mountain_id를 사용한다. Java는 기존 원본의 해시가 같을 때만 산 소속을 갱신한다. 원본 내용이 달라지면 파일 전체를 거부한다. 시설 ID, 원본 필드·해시, 적재 시각과 제보 참조를 보존한다.

코스 조회는 같은 산 소속과 반경 조건을 함께 사용하며 경계를 다시 계산하지 않는다. 상세·출처별 검토 조회는 외부 시설도 반환한다.

공원 전체 경계와 북한산·도봉산을 분리한 산별 경계는 다르다. 현재 ID 2는 두 지역 후보에 적용하는 개발용 기본값이다. 향후 산별 행을 나누려면 각 산의 경계와 매핑을 별도로 정해야 한다.

## 실제 경계 자료 검토: 2026-10-25

로컬 `국립공원공단_국립공원 공원경계_20231231/공원경계버퍼/BSI_NPK_BBNDR.shp`는 사용하지 않는다. 사용자가 버퍼를 사용하지 않기로 결정했으며, DB 경계는 NULL로 유지했다.

- 실제 `.prj`는 EPSG:5179다.
- 북한산 속성은 NPK_CD=L999M001S009, CRT_YMD=20241230이다.
- XML에는 3 Kilometers Buffer 처리 이력이 있다.
- [공공데이터포털 원문](https://www.data.go.kr/data/15017313/fileData.do)의 설명과 실제 파일의 좌표계·기준일이 다르다.
- 포털에서 다시 받은 ZIP의 SHP·DBF·PRJ·XML도 로컬 자료와 바이트 단위로 동일하다.
- SHP SHA-256: `1fb91a6c978471bb6c2a93ded144b4f78cf1745b05f07857b0dfcd76c804ab4b`

다운로드는 Git에서 제외되는 `data/raw/knps/boundaries/portal-15017313/park-boundary.zip`에 보관했다. 실제 파일은 기존 프로젝트 `D:/Project/trail-map/data`에 있다. 버퍼를 축소해 실제 경계를 추정하지 않는다. **버퍼 없는 원본 확보와 검증 후 실제 경계 적용·재판정이 남아 있다.**

## 검증

PostGIS용 PG* 환경 변수를 설정하고 프로젝트 루트에서 실행한다.

    $env:FACILITY_TEST_DATABASE = '1'
    & data-pipeline/.venv-facility/Scripts/python.exe -m pytest data-pipeline/tests/test_facilities.py data-pipeline/tests/test_mountain_membership.py

Python은 세션 임시 테이블을 사용한다. 내부·외부·외곽/구멍 경계·경계 NULL·경계 추가 후 재판정·잘못된 도형·없는 산·DB 실패를 확인한다. 실제 시설/산 데이터에는 쓰지 않는다. 위 환경 변수가 없으면 DB 테스트를 생략한다.

Java의 `FacilityPostgisIntegrationTest`는 기존 v1 해시 호환, 신규 소속 저장, null→산 ID→null 갱신, 재실행, 시설 ID와 제보 참조 보존, 원본 변경 거부, 같은/다른 산·미소속과 거리 안/밖을 검증한다. 테스트 행은 롤백된다.

현재 실제 후보는 화장실 출처 4의 95개, 샘터 출처 6의 1개, 기타구축물 음수대 출처 7의 3개다. 경계가 NULL이므로 99개 모두 boundaryUnset, mountainId=2이며 내부 판정 건수는 0이다. 실제 내부/외부 건수는 아직 확정하지 않았다.

실행 결과: Python 27개 통과, 실제 PostGIS 시설 통합 테스트 9개 통과. 전체 백엔드 테스트도 성공했으며 별도 환경이 필요한 일정·Testcontainers 테스트 6개는 생략되었다. 세 출처를 각각 두 번 적재해 inserted=0, updated=0, skipped=95/1/3을 확인했다. 기존 99개 행의 전체 값과 facility_report 건수는 재적재 전후 동일하다. 제보 참조 보존은 별도 통합 테스트에서 제보 행을 만들어 검증했다.

새 코드의 임시 8081 서버에서 코스 2·250m 조회는 화장실 4개, 음수대 0개였다. 출처 검토 조회는 95/1/3개, 기존 시설 상세도 정상 응답했다. 8081 서버는 확인 후 종료했으며 기존 8080 서버에 새 코드가 자동 반영된 것은 아니다. 변경 코드는 별도 `feature/69-facility-mountain-boundary` 작업 폴더에 있다.
