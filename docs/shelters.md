# 북한산·도봉산 쉼터 전처리

국립공원공단 기타구축물 CSV를 기존 시설 적재기가 읽는 공통 JSON으로 변환한다.
공통 전처리에서 음수대와 같은 출처의 JSON v2로 묶어 DB에 적재하고, 코스 상세의 쉼터·전체 탭과 개발용 검토 지도에 연결한다. 전체 실행 과정은 [공통 전처리 문서](facility-pipeline.md)를 참고한다.

## 원본과 선택 기준

원본은 CP949 CSV이며 프로젝트 루트의 다음 경로에 둔다.

```text
data/raw/knps/shelters/국립공원공단_기타구축물_20240911.csv
```

- CSV에 유효한 좌표가 있는 파고라·쉼터·정자형 구조물만 선택한다.
- CSV 구조를 확인한 뒤 각 행의 `X좌표`·`Y좌표`가 모두 채워져 있는지 먼저 검사한다. 하나라도 비어 있거나 공백뿐이면 시설명 검사 전에 제외한다.
- 시설명에 `파고라`, `쉼터`, `정자`가 있어야 한다. 상대위치에만 쉼터가 적힌 의자나 종류를 알 수 없는 구조물은 포함하지 않는다.
- 시설명에 벤치·의자 등 다른 구조물이 명시된 행은 제외한다. 파고라·쉼터의 부속 `벤치개수`는 제외 기준으로 사용하지 않는다.
- 전국 원본에 공원 코드가 없어 기존 음수대 전처리와 같은 경도 126.90~127.07, 위도 37.59~37.75 범위로 북한산·도봉산 대상을 한정한다. 이 사각형은 공원 경계가 아니므로 새 원본을 적용할 때 포함 대상을 다시 검토한다.
- `X좌표`를 경도, `Y좌표`를 위도로 사용한다. 좌표 누락·비정상 수치·뒤바뀐 축은 제외하며, 주소를 이용한 좌표 추정이나 지오코딩은 하지 않는다.
- 시설 크기는 원본의 단위가 혼재되어 있어 구조물 종류 판정에 사용하지 않는다.

2024-09-11 원본의 검증 결과는 1,283행 중 5건이다. 행 번호는 CSV 헤더를 포함한다.

| CSV 행 | 시설명 | 상대위치 |
| ---: | --- | --- |
| 44 | 송추파고라 | 송추입구~송추분소 |
| 291 | 송추파고라 | 송추분소~송추분소 |
| 554 | 파고라(보광사 순례길 입구) | 파고라(보광사 순례길 입구) |
| 555 | 파고라-순례길(이준열사입구) 앞 | 파고라-순례길(이준열사입구) 앞 |
| 765 | 원도봉 진입부 쉼터 | 원도봉 사무소 앞 |

처리 순서는 좌표 유무 → 시설명 → 좌표 유효성·지역 범위 → 중복 확인이다.

| 단계 | 제외 행 | 남은 행 |
| --- | ---: | ---: |
| 원본 | — | 1,283 |
| X좌표·Y좌표 중 하나라도 누락 | 1,001 | 282 |
| 쉼터 구조물이 아닌 시설명 | 251 | 31 |
| 좌표 유효성·지역 범위 확인 | 26 | 5 |

이번 원본에서 마지막 26행은 모두 검토 범위 밖이며, 좌표 수치 오류나 중복으로
추가 제외된 행은 없다. 여러 제외 조건에 해당하면 처음 확인한 사유로 집계한다.
따라서 좌표가 없는 벤치도 `missing_coordinates`로 집계한다. `selected`는 좌표가
채워져 있고 시설명 조건을 통과한 31행이다. 이 통계는 전국 원본 전체를 기준으로 한다.

## 실행

프로젝트 루트 PowerShell에서 시설 전용 가상환경을 준비한다. 이미 있다면 재사용한다.

```powershell
python -m venv data-pipeline/.venv-facility
& data-pipeline/.venv-facility/Scripts/python.exe -m pip install -r data-pipeline/requirements-facility.txt
```

```powershell
$env:PYTHONPATH = 'data-pipeline/src'
& data-pipeline/.venv-facility/Scripts/python.exe -m trail_map_data.facilities.knps_shelters 'data/raw/knps/shelters/국립공원공단_기타구축물_20240911.csv' 'data/processed/knps/shelters/candidates.json'
```

기존 출력 교체에는 `--overwrite`를 명시한다. 다른 인코딩은 `--encoding utf-8-sig`,
다른 원본 기준일은 `--source-date YYYY-MM-DD`로 지정한다. 입력과 출력 경로가 같으면 실패한다.
원본·가공 데이터는 `data/` 아래에 보관하며 Git에 포함하지 않는다.

## 산출물

- 개별 어댑터는 `schemaVersion: 1`, `type: SHELTER`인 후보를 생성한다. 공통 전처리는 산 소속 판정 후 `schemaVersion: 2`의 structures.json을 생성하며, Java 적재기에는 v2만 전달한다.
- 기존 음수대와 같은 출처명·버전 및 이름+상대위치의 SHA-256 합성 식별자 규칙을 사용한다. 행 순서나 좌표를 식별자에 넣지 않는다.
- 동일 식별자·내용의 행은 한 번만 출력한다. 같은 식별자의 좌표가 충돌하면 임의로 선택하지 않고 실패한다. 서로 다른 시설의 좌표가 같다는 이유만으로 합치지 않는다.
- 기존 전처리 결과 형식을 따라 `report`에 처리 건수, 포함 행의 원본 속성과 CSV 행 번호, 제외 행 정보를 담는다.
- `sourceDate`는 원본 기준일이며 운영 확인일이 아니다. `sourceReportedStatus`는 `null`로 둔다.
- 결과가 없는 경우와 CSV 구조 오류는 실패로 처리하며 기존 출력 파일을 교체하지 않는다.
- JSON 저장 함수는 화장실 코드에서 공용 `facilities/document.py`로 옮겨 재사용한다. 쉼터 CSV 처리 자체는 Python 표준 라이브러리만 사용한다.

## 검증

```powershell
$env:PYTHONPATH = 'data-pipeline/src'
& data-pipeline/.venv-facility/Scripts/python.exe -m pytest data-pipeline/tests/test_facilities.py data-pipeline/tests/test_shelters.py -q
```

시설명보다 좌표 누락을 먼저 확인하는 순서, 구조물·벤치 구분, 부속 벤치 보존,
좌표 오류와 범위 경계, 안정적인 식별자,
중복·충돌, CSV 오류, 인코딩·기준일 옵션, 덮어쓰기·원본 보호와 기존 화장실 동작을 확인한다.
