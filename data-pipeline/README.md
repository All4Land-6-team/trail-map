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

## 테스트

실제 DEM 대신 테스트 중 생성되는 소형 GeoTIFF를 사용합니다.

```bash
PYTHONPATH=src pytest
```

