# Frontend

React, Vite, TypeScript, MapLibre GL JS 기반 프론트엔드입니다.

## 실행

```powershell
npm install
npm run dev
```

프로덕션 빌드는 `npm run build`로 확인합니다.

## 폴더 규칙

- `pages/<PageName>/components`: 해당 페이지에서만 사용하는 컴포넌트
- `components/common`: 버튼·입력창·모달처럼 여러 페이지에서 재사용하는 UI
- `components/layout`: 헤더·사이드바·바텀시트 등 화면 골격 UI
- `components/map`: MapLibre 공용 컴포넌트와 지도 관련 공용 코드
- `api`: Axios 설정과 백엔드 API 요청
- `hooks`: 재사용 Custom Hook
- `store`: 전역 상태 관리 코드
- `types`: 공용 TypeScript 타입
- `utils`: 순수 유틸리티 함수
- `constants`: API 주소, 지도 기본 좌표·줌 같은 고정값

`.env` 파일은 커밋하지 않고 `.env.example`을 복사해 사용합니다.

## 환경 변수

| 이름 | 설명 | 기본값 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 백엔드 API 주소 | `http://localhost:8080` |
| `VITE_MAP_STYLE_URL` | 배경지도 스타일 주소 (MapLibre 스타일 JSON) | OpenFreeMap Liberty |
| `VITE_OFFLINE_STATIC_GEO_URLS` | 캐시할 공개·정적 등산로/시설물 API 주소 목록 (쉼표로 구분) | 비어 있음 |

## 오프라인 캐시 정책

OpenFreeMap 배경지도는 공급원의 HTTP 응답에 따른 기본 브라우저 캐시를 사용합니다. 현재 앱은 OpenFreeMap 스타일·벡터 타일을 서비스 워커나 Cache Storage에 별도로 저장하거나 지역 단위로 미리 내려받지 않습니다. 브라우저 캐시는 저장 여부와 보존 기간을 브라우저가 결정하므로, 방문한 배경지도가 오프라인에서 항상 보인다고 보장하지 않습니다.

[OpenFreeMap의 공식 안내](https://openfreemap.org/quick_start/)에 따르면 오프라인 다운로드는 1회 최대 3,000타일 또는 50MB, 동시 요청 최대 4개, 앱을 식별하는 고유 User-Agent 조건에서 허용됩니다. 이 제한을 넘는 다운로드는 공급원에 별도 문의가 필요합니다. 앱에서 별도 저장 기능을 도입할 때는 이 조건과 [이용약관](https://openfreemap.org/tos/)을 다시 확인합니다.

등산로·시설물의 공개 정적 API가 준비되면 `VITE_OFFLINE_STATIC_GEO_URLS`에 정확한 조회 주소를 지정합니다. 지정한 주소로 실제 요청한 성공 응답만 별도 캐시에 저장하며, 네트워크가 끊기면 이전에 방문한 동일 요청(URL과 쿼리 포함)의 응답을 사용합니다. 주소가 아직 없어 기본값은 빈 목록입니다. 이 목록에는 개인화 데이터나 실시간 정보 주소를 넣지 않습니다. 인증 헤더가 포함된 요청은 캐시하지 않습니다.

프로덕션 빌드에는 서비스 워커가 앱 셸의 HTML·JavaScript·CSS와 화면에 쓰는 SVG를 사전 캐시합니다. 처음 온라인으로 접속해 서비스 워커 설치가 끝난 뒤에는 같은 범위의 앱 화면을 오프라인에서 열 수 있습니다. 개발 서버에서는 사전 캐시가 비활성화되므로 `npm run build` 후 `npm run preview`로 확인합니다.

연결이 끊기면 지도 위에 오프라인 상태와 실시간 정보 제한을 알립니다. 저장되지 않은 배경지도 요청과 정적 데이터 요청은 각각 별도로 안내합니다. 배경지도는 공급원 정책에 따라 별도 저장하지 않으므로 방문 지역이라도 오프라인 표시를 보장하지 않습니다. 서비스 워커의 캐시 동작은 `npm run test:offline`로 검사합니다.
