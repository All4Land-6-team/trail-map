# 북한산·도봉산 음수대

화장실과 같은 `공통 JSON → FacilityImportRunner → 시설 테이블 → 코스 주변 API` 흐름을 사용한다. 샘터·약수터·음수대를 `DRINKING_WATER` 한 유형으로 저장하고 화면에는 `음수대`로 표시한다. 하위 카테고리는 만들지 않는다.

## 원본과 선택 기준

원본은 CP949 CSV다. 다운로드 파일은 다음 위치로 복사한다. 원본·가공 데이터는 Git에서 제외된다.

- `data/raw/knps/drinking-water/springs/GSTN_SPRG_PT.csv` — 국립공원공단 국립공원 샘터, 2024-05-22 스냅샷
- `data/raw/knps/drinking-water/structures/국립공원공단_기타구축물_20240911.csv` — 기타구축물, 2024-09-11 스냅샷

샘터 폴더의 SHP는 `.prj`의 미터 좌표계 선언과 실제 경도·위도 형태의 점 좌표가 일치하지 않는다. 이를 임의로 재투영하지 않고, 명시적인 `경도`, `위도` 열이 있는 동봉 CSV를 사용한다.

- 샘터: `국립공원`이 북한산 또는 도봉산인 행을 선택한다.
- 기타구축물: 시설명 자체가 음수대·약수터·샘 등인 행을 선택하고 벤치·휀스·난간 등은 제외한다. 상대위치에 샘 이름이 있다는 이유만으로 포함하지 않는다.
- 경도·위도 결측, 비정상 값, 뒤바뀐 축은 제외한다. 주소로 추정한 좌표를 생성하지 않는다.
- 두 원본 모두 경도 126.90~127.07, 위도 37.59~37.75의 검토 범위를 적용한다. 이 범위는 공원 경계 폴리곤이 아니며, 새 원본 버전 적용 시 포함 결과를 다시 검토한다.
- `망월사하단 덕재샘`과 `망월사아래 덕재샘`만 검토한 동일 시설 별칭으로 묶는다. 두 좌표가 30m를 초과해 벌어지면 처리를 중단한다. 대표 좌표는 원본 중 경도·위도 순으로 가장 작은 것을 선택한다. 평균 좌표를 만들거나 다른 근접 시설을 자동 통합하지 않는다.
- `수도가랑`의 값이나 데이터 등록일을 현재 이용 가능·음용 적합 판정으로 해석하지 않는다. `sourceReportedStatus`는 `null`이며 `sourceDate`는 원본 스냅샷 기준일이다.

현재 원본 검증 결과:

| 원본 | 입력 행 | 적재 행 | 시설 |
| --- | ---: | ---: | --- |
| 샘터 CSV | 11 | 1 | 탕춘대 샘터 |
| 기타구축물 CSV | 1,283 | 3 | 망월사하단 덕재샘, 회룡계곡 원도봉 회룡약수터, 포대능선하단 민초샘 |

기타구축물에서 제외한 1,280행은 물 시설이 아닌 행 1,109건, 좌표 결측 163건, 후보 범위 밖 7건, 덕재샘 중복 1건이다. 이 제외 통계는 전국 원본 전체에 대한 수치다.

## 전처리

프로젝트 루트 PowerShell에서 실행한다. 기존 화장실용 가상환경을 재사용한다.

    $env:PYTHONPATH = 'data-pipeline/src'
    & data-pipeline/.venv-facility/Scripts/python.exe -m trail_map_data.facilities.knps_drinking_water springs 'data/raw/knps/drinking-water/springs/GSTN_SPRG_PT.csv' 'data/processed/knps/drinking-water/springs.json'
    & data-pipeline/.venv-facility/Scripts/python.exe -m trail_map_data.facilities.knps_drinking_water structures 'data/raw/knps/drinking-water/structures/국립공원공단_기타구축물_20240911.csv' 'data/processed/knps/drinking-water/structures.json'

기존 출력 교체는 `--overwrite`를 명시한다. 원본 버전이 다른 경우 `--source-date YYYY-MM-DD`로 실제 스냅샷 날짜를 지정하고 결과를 다시 검토한다. 기본 인코딩은 CP949이며 UTF-8 CSV는 `--encoding utf-8-sig`를 지정한다.

위 개별 명령은 DB에 연결하지 않는 후보 JSON v1 생성용이다. DB 적재에는 [공통 전처리 명령](facility-pipeline.md)을 사용해 산 소속이 포함된 JSON v2를 생성한다. 샘터 출처는 별도 파일로 유지하고, 기타구축물 출처는 쉼터와 음수대를 하나의 structures.json으로 묶는다. `report.rejectedRecords`는 제외 행과 이유, `report.sourceRecords`는 포함 행의 원본 속성·CSV 행 번호, `report.mergedRecords`는 별칭 통합과 대표 좌표 선택 근거를 보존한다.

CSV에는 OBJECTID 열이 없다. `sourceRecordId`는 공백을 정규화한 원본 시설명과 위치 설명을 SHA-256으로 해시한 `csv-...` 합성 식별자다. CSV 행 순서나 좌표 값은 식별자에 넣지 않아 순서 변경 시에도 재적재가 중복되지 않으며, 같은 시설의 좌표 변경은 기존 적재기가 충돌로 감지한다. 검토한 덕재샘 그룹에는 `reviewed-deokjaesaem`을 사용한다. 같은 이름·위치의 상충된 레코드는 임의로 고르지 않고 실패한다. 원본 명칭이 변경되는 새 버전은 별도 검토가 필요하다.

## DB 적재와 서버 실행

기존 [시설 데이터 문서](facilities.md)의 DB 환경 설정을 사용한다. [공통 전처리](facility-pipeline.md)로 JSON v2를 생성한 뒤 `backend`에서 출처별 파일을 각각 적재한다. 후보 JSON v1은 직접 적재하지 않는다. `DB_PASSWORD`는 환경변수 또는 로컬 비밀 설정에 지정하며 루트 `.env`를 Spring이 자동으로 읽지는 않는다.

    $env:TERRAIN_ROOT_PATH = 'D:/Project/trail-map/data/processed/dem/bukhansan/terrain'
    .\gradlew.bat bootRun --args='--spring.main.web-application-type=none --facility.import.enabled=true --facility.import.file=D:/Project/trail-map/data/processed/knps/facilities/springs.json'
    .\gradlew.bat bootRun --args='--spring.main.web-application-type=none --facility.import.enabled=true --facility.import.file=D:/Project/trail-map/data/processed/knps/facilities/structures.json'

적재 프로그램은 저장 후 종료한다. 두 파일은 출처별 독립 트랜잭션이다. 같은 파일을 다시 실행하면 기존 행을 건너뛰며, 원본 내용이 변경된 경우 기존 시설을 덮어쓰지 않고 실패한다. 새 migration이나 별도 적재 API는 필요하지 않다.

개발용 전체 검토 화면도 확인하려면 백엔드를 다음과 같이 실행한다.

    .\gradlew.bat bootRun --args='--facility.review.enabled=true'

프론트는 `frontend`의 별도 터미널에서 `npm run dev -- --port 5173 --strictPort`로 실행한다. 5173이 사용 중이면 기존 서버를 확인하며 5174로 자동 전환하지 않는다.

## 조회와 화면

- 코스 주변: `GET /api/v1/courses/{courseId}/facilities?type=DRINKING_WATER&radiusMeters=250`
- 시설 상세: `GET /api/v1/facilities/{facilityId}`
- 출처 검토: `GET /api/v1/facilities/review?sourceId={sourceId}&type=DRINKING_WATER`
- 개발용 검토 지도: `http://localhost:5173/?preview=facilities&sourceId={sourceId}&type=DRINKING_WATER`

`sourceId`는 적재 로그를 확인한다. 이번 개발 DB에서는 샘터가 6, 기타구축물이 7이지만 다른 DB에서는 달라진다. 검토 지도는 개발 모드에서만 접근 가능하며 운영 번들에 포함되지 않는다.

코스 상세의 `음수대`는 실제 API 결과만 사용한다. `전체`는 화장실·음수대·쉼터를 각각 요청해 유형별 로딩·실패·재시도를 처리한다. 빈 결과·오류·미연결 코스에서 mock 음수대를 대체 표시하지 않는다. 목록과 지도는 동일한 시설 ID·좌표를 사용한다. 음수대가 존재해도 해당 코스의 전체 LineString에서 250m 밖이면 표시하지 않는다.

현재 연결된 DB 코스 ID 2는 백운대 mock 경로다. 실제 적재 후 이 경로 주변은 화장실 4건, 음수대 0건이며 음수대 0건이 정상이다. 실제 북한산·도봉산 코스 연동 시 동일 코스의 DB ID와 지도 좌표를 함께 제공해야 한다. 시설을 보여주기 위해 기존 코스·시설 좌표 또는 반경을 변경하지 않는다.

## 검증

- Python: `python -m pytest data-pipeline/tests/test_facilities.py data-pipeline/tests/test_drinking_water.py` (`PYTHONPATH=data-pipeline/src`, 시설 가상환경 사용)
- 프론트: `npm run test:course-facilities`, `npm run test:facilities`, `npm run test:course-detail`, `npm run lint`, `npm run build` (Node 24 기준)
- 백엔드: `.\gradlew.bat test`. 실제 공간 조회는 시설 문서의 `FACILITY_TEST_*` 환경변수를 지정하고 `FacilityPostgisIntegrationTest`를 실행한다. 테스트 데이터는 롤백된다.
- 실제 원본 1+3건 적재 후 같은 JSON 재적재 시 inserted=0, skipped=1/3 확인


통합 구현의 최신 검증 결과와 브라우저 확인 제한은 [공통 전처리 문서](facility-pipeline.md)를 참고한다.
