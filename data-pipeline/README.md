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

