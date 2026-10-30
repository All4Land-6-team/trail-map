# Data Pipeline

DEM 등 공간데이터를 서비스에서 사용하기 전에 가공하는 코드를 관리합니다.

## 폴더 역할

- `src/trail_map_data`: 데이터 전처리 코드
- `tests`: 데이터 전처리 테스트
- `tests/fixtures`: Git에 포함할 수 있는 소형 테스트 데이터
- `../data/raw`: 원본 데이터
- `../data/interim`: 중간 가공 데이터
- `../data/processed`: 최종 가공 데이터

원본과 가공 데이터는 프로젝트 루트의 `data/`에 저장하며 Git에 커밋하지 않습니다.

## Python 환경 준비

```bash
cd data-pipeline
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

명령은 `data-pipeline` 디렉터리에서 실행합니다.

## 북한산 DEM 입력

북한산 코스 분석과 Terrain 타일 생성의 기준 원본은 다음 경로에 둡니다.

```text
../data/raw/dem/bukhansan/북한산.tif
```

`data/`는 Git에서 제외됩니다. 원본 DEM이나 생성된 GeoTIFF를 커밋하지 않습니다.

현재 원본 파일의 좌표계 WKT에는 EPSG 권한 정보가 없을 수 있습니다. 좌표계는
출처 메타데이터로 확인하기 전까지 임의로 EPSG:5186으로 변경하지 않습니다.

## DEM 메타데이터 검사

```bash
PYTHONPATH=src python -m trail_map_data.cli dem inspect \
  ../data/raw/dem/bukhansan/북한산.tif \
  --expected-crs EPSG:5186 \
  --output ../data/interim/dem/bukhansan/metadata.json
```

검사 결과에는 크기, 해상도, 좌표 범위, 좌표계, NoData, 유효 픽셀 수,
고도 최솟값·최댓값과 저장 형식이 포함됩니다. `matches_expected`가 `false`라면
원본 출처를 확인하기 전까지 좌표계를 강제로 덮어쓰지 않습니다.

## 분석용 GeoTIFF 생성

```bash
PYTHONPATH=src python -m trail_map_data.cli dem optimize \
  ../data/raw/dem/bukhansan/북한산.tif \
  ../data/processed/dem/bukhansan/analysis/bukhansan_dem.tif \
  --expected-crs EPSG:5186 \
  --metadata-output ../data/processed/dem/bukhansan/analysis/metadata.json \
  --overwrite
```

분석용 GeoTIFF는 원본 고도값·공간 범위·좌표계를 유지하며 다음 저장 최적화를
적용합니다.

- 512×512 내부 타일
- DEFLATE 무손실 압축
- 2·4·8·16단계 오버뷰
- 원본 NoData 및 밴드 메타데이터 보존

좌표계가 출처 자료로 확정된 후 엄격하게 검사하려면
`--require-crs-match`를 추가합니다.

동일한 출력 GeoTIFF와 메타데이터 경로를 대상으로 여러 프로세스를 동시에
실행하지 않습니다. 각 파일은 임시 파일 검증 후 원자적으로 교체되지만 두 산출물
사이의 다중 프로세스 잠금은 제공하지 않습니다. 메타데이터 저장이 실패한 경우에는
원인을 해결한 뒤 같은 명령을 `--overwrite`와 함께 다시 실행합니다.

## Terrain-RGB XYZ 타일 생성

분석용 GeoTIFF를 MapLibre의 `raster-dem` 소스에서 사용할 수 있는 Mapbox
Terrain-RGB 형식으로 변환합니다. 고도는 0.1m 단위 RGB 값으로 인코딩하며,
MapLibre가 NoData를 `-10000m`로 해석하지 않도록 투명 픽셀을 남기지 않습니다.
대신 DEM 외곽 1km 구간의 고도를 전역 좌표 기준으로 0m까지 완만하게 낮추고,
내부의 작은 결측만 인접 고도로 보간합니다. 이로써 타일 경계에서 산이
길게 늘어지거나 절벽처럼 세워지는 현상을 방지합니다.

```bash
PYTHONPATH=src python -m trail_map_data.cli dem terrain-tiles \
  ../data/processed/dem/bukhansan/analysis/bukhansan_dem.tif \
  ../data/processed/dem/bukhansan/terrain \
  --min-zoom 10 \
  --max-zoom 16 \
  --max-tiles 2000 \
  --edge-feather-meters 1000 \
  --overwrite
```

서비스의 타일 API 주소를 TileJSON에 미리 기록하려면 URL 템플릿을 지정합니다.

```bash
PYTHONPATH=src python -m trail_map_data.cli dem terrain-tiles \
  ../data/processed/dem/bukhansan/analysis/bukhansan_dem.tif \
  ../data/processed/dem/bukhansan/terrain \
  --min-zoom 10 \
  --max-zoom 16 \
  --max-tiles 2000 \
  --edge-feather-meters 1000 \
  --tiles-url "/api/v1/terrain/{z}/{x}/{y}.png" \
  --overwrite
```

`--min-zoom`, `--max-zoom`, `--max-tiles`는 필수 옵션입니다. 서비스에서 필요한
지도 확대 범위와 저장 용량을 검토해 지정하며, 생성기는 0~22 범위만 허용합니다.
생성 전 계산한 예상 타일 수가 `--max-tiles`를 넘으면 작업을 시작하지 않습니다.
`--edge-feather-meters`는 DEM 외곽을 0m로 연결하는 완충 거리이며 기본값은 1000m입니다.

산출물은 다음 구조로 생성됩니다.

```text
../data/processed/dem/bukhansan/terrain/
├── maplibre-source.json
├── metadata.json
├── tilejson.json
└── tiles/
    └── {z}/{x}/{y}.png
```

- `tiles`: XYZ 방식의 256×256 RGBA PNG 타일
- `tilejson.json`: TileJSON 3.0 형식의 범위, 줌 레벨과 타일 URL
- `maplibre-source.json`: `raster-dem`, 256px, `mapbox` 인코딩을 명시한
  MapLibre 소스 설정
- `metadata.json`: 입력 파일 절대 경로와 전체 생성 타일 수를 포함한 작업 결과

기존 출력 디렉터리는 기본적으로 덮어쓰지 않습니다. `--overwrite`를 지정한
경우에도 새 산출물을 임시 디렉터리에서 모두 만든 뒤 기존 디렉터리와 교체합니다.
원본 DEM의 좌표계는 수정하지 않고, 각 XYZ 타일을 만들 때만 EPSG:3857로
재투영합니다. 같은 출력 경로로 여러 생성 작업을 동시에 실행하거나 타일 제공
프로세스가 해당 디렉터리를 읽는 중에 `--overwrite`를 실행하지 않습니다.

## 코스 고도·경사 분석

`course analyze`는 분석용 GeoTIFF와 EPSG:4326 코스 GeoJSON Feature 하나를
받아 프로필과 요약 지표를 JSON으로 저장합니다. 좌표는 `[경도, 위도]` 순서이며
`FeatureCollection`, `MultiLineString`, 기존 `crs` 확장은 지원하지 않습니다.
선택적 세 번째 좌표(Z)는 사용하지 않고 고도는 DEM에서 추출합니다.

입력 Feature의 `properties`에는 양의 정수 `course_id`, `mountain_id`,
`course_version`이 필요합니다. `course_name`, `source_id`는 선택 항목입니다.
`source_kind`는 `development`, `official`, `user`, `unknown` 중 하나이며 기본값은
`unknown`입니다. 개발용 시드에서 내보낸 경로는 `development`로 표시합니다.
실제 DEM 위에 예시 경로를 놓은 결과는 실제 등산로의 분석 결과와 구분합니다.

다음은 입력 형식의 예시이며 좌표는 공식 등산로 데이터가 아닙니다.

```json
{
  "type": "Feature",
  "properties": {
    "course_id": 1,
    "mountain_id": 1,
    "course_version": 1,
    "course_name": "개발용 예시 경로",
    "source_kind": "development"
  },
  "geometry": {
    "type": "LineString",
    "coordinates": [[126.9905, 37.662], [126.9885, 37.6618]]
  }
}
```

```bash
PYTHONPATH=src python -m trail_map_data.cli course analyze \
  ../data/processed/dem/bukhansan/analysis/bukhansan_dem.tif \
  ../data/interim/courses/course-1.geojson \
  --sample-interval-meters 10 \
  --output ../data/processed/course-analysis/course-1.json
```

위의 10m는 실행 예시이며 운영 정책으로 확정된 간격이 아닙니다. 간격은 필수
설정이고, 시작·끝과 원본 굴곡점을 보존하므로 실제 샘플 간격은 설정값 이하입니다.
거리는 원본 DEM의 투영 좌표계에서 잰 2D 수평 거리이며 좌표계의 길이 단위를
m로 환산합니다. 경도·위도 단위의 DEM이나 좌표계가 없는 DEM은 거리를 잘못
계산하지 않도록 거절합니다. 원본 DEM의 좌표계 WKT를 변경하지 않습니다.

기본 `--sampling-method bilinear`는 픽셀 중심 기준 보간이며, 양의 가중치가
있는 이웃 픽셀이 모두 유효해야 합니다. DEM 가장자리에서 이웃이 부족해도
임의로 채우지 않습니다. 셀 값을 직접 읽으려면 `--sampling-method nearest`를
명시합니다. NoData·NaN·무한값·범위 밖 샘플은 `null`과 사유를 남기고, 해당
샘플을 건너뛰어 경사나 상승·하강량을 계산하지 않습니다. 밴드 scale·offset도
적용합니다. 최대 샘플 수는 기본 100,000개이며 `--max-samples`로 조정합니다.

`--elevation-unit auto`가 기본이며 DEM 밴드에 m 또는 국제 피트(ft)가 명시된
경우만 m 단위로 환산합니다. 단위가 없거나 인식할 수 없으면
`elevation_source_value`에 원본 단위의 값만 남기고 `elevation_meters`,
`slope_percent` 및 m 단위 고도 요약은 `null`입니다. 출처에서 확인한 단위만
`--elevation-unit m` 또는 `ft`로 지정합니다. `--vertical-reference`에도 출처에서
확인한 수직 기준을 기록합니다. 미지정·`unknown`·`unverified`는 미확정으로
처리하며, 테스트용 임의 기준을 실제 DEM에 적용하지 않습니다.

결과의 주요 항목은 다음과 같습니다.

- `schema_version`, `algorithm_version`, `source_type`, `calculated_at`
- `course`: 코스·산 ID, 코스 버전, 원본 경로, 출처 종류
- `inputs`: 입력 파일 경로·SHA-256, DEM 보조 파일 지문, 원본 좌표계·밴드 정보
- `settings`: 샘플 간격·보간 방식·고도 단위와 선언 출처·수직 기준·거리 계산 방식
- `profile`: 샘플 순번·누적 거리·경도/위도·원본 고도값·m 단위 고도·샘플 상태
- `summary`: 거리·최저/최고 고도·누적 상승/하강량·샘플 및 거리 커버리지
- `quality_status`, `quality_reasons`, `diagnostics`

`slope_percent`는 이전 샘플로부터의 `고도 변화 / 수평 거리 × 100`입니다.
상승은 양수, 하강은 음수이며 첫 샘플과 결측 구간에는 값이 없습니다.
노이즈 필터·평활화는 적용하지 않고 `elevation_processing=unsmoothed`로 기록합니다.
분석 간격·평활화 정책이 달라지면 상승량과 경사가 달라질 수 있습니다.

- `AVAILABLE`: 모든 샘플과 m 단위·수직 기준이 제공된 경우
- `PARTIAL`: 일부 샘플이 없거나 고도 단위·수직 기준이 미확정인 경우
- `NO_DATA`: 유효 DEM 샘플이 하나도 없는 경우

커버리지는 선택한 샘플 기준이며 샘플 사이의 모든 픽셀을 검사했다는 뜻은
아닙니다. 결측이 있으면 상승·하강량은 연속해서 관측된 구간의 합계입니다.
계산 가능한 연속 구간이 없으면 0 대신 `null`입니다. 고도 단위가 확인돼도 수직
기준이 미확정이면 계산값은 제공하되 `PARTIAL`과 사유를 표시합니다. 품질 상태는
분석 입력의 가용성을 나타내며 실제 측량 정확도를 보증하지 않습니다.

기존 출력은 기본적으로 보호하며 교체할 때만 `--overwrite`를 사용합니다.
입력·DEM 보조 파일과 출력 경로가 같으면 거절하고, 완료된 JSON만 원자적으로
저장합니다. 원본·가공 파일은 루트 `data/`에 두고 Git에 포함하지 않습니다.
이 단계는 DB를 변경하지 않으며 Spring 조회 API와 코스 비교는 후속 작업입니다.

## 테스트

실제 DEM 대신 테스트 중 생성되는 소형 GeoTIFF를 사용합니다.

```bash
PYTHONPATH=src pytest tests/test_dem.py tests/test_terrain.py tests/test_course_analysis.py
```


## 공식 시설 데이터

후보 JSON 생성 후 `trail_map_data.facilities.mountain_membership`을 실행해 DB 경계로 산 소속을 판정한다. [산 경계 문서](../docs/facility-mountain-boundary.md)에 DB 연결, 경계 NULL 기본 할당과 재판정 절차를 설명한다.

시설 전처리는 별도 패키지와 가상환경으로 실행합니다. [시설 데이터 문서](../docs/facilities.md)에 공통 JSON 계약과 화장실 시범 실행 방법이 있습니다.

## 공식 시설 공통 파이프라인 (#75)

화장실·쉼터·음수대의 한 번의 전처리, 출처별 JSON v2 적재, 산 소속 판정 및 실행·검증 방법은 [공통 시설 파이프라인](../docs/facility-pipeline.md)을 따른다. 개별 어댑터의 v1은 후보 검토용이며 직접 DB에 적재하지 않는다.
