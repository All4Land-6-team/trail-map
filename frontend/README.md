# Frontend

React, Vite, TypeScript, MapLibre GL JS 기반 프론트엔드입니다.

## 실행

```powershell
npm install
npm run dev
```

프로덕션 빌드는 `npm run build`로 확인합니다.

## 홈 산 탐색 (FLOW-01)

- 첫 화면에 실제 배경지도, 대표 산 5개의 마커, 최근 본 산, 오늘 일정 배너를 표시합니다.
- 검색 버튼을 누르면 산 이름 입력 모드가 됩니다. Enter 또는 검색 버튼으로 검색하고 Escape로 입력 모드를 종료합니다. 한글 조합 중 Enter는 검색으로 처리하지 않습니다.
- 이름이 정확히 일치하는 산을 우선하고, 이후 이름에 검색어를 포함하는 첫 산을 선택합니다. 결과가 없으면 Toast를 표시합니다.
- 최근 본 산은 브라우저 로컬 저장소에 최대 5개를 저장합니다. 저장소가 차단되거나 값이 손상되어도 탐색은 계속 사용할 수 있습니다.
- `src/api/homeMock.ts`는 화면 확인용 데이터입니다. API·DB 연결이나 실제 등산로·통제·일몰 데이터는 포함하지 않습니다.
- 홈·코스 화면은 최대 폭 390px, 중앙 정렬, 100dvh를 기준으로 합니다. 운영체제 상태 표시줄과 시안의 빨간 주석 번호는 앱 UI에 포함하지 않습니다.

### 후속 화면 연결

`HomePage`의 `onMountainSelect`와 `onScheduleOpen`으로 화면 이동을 연결합니다. 기본 이동 경로는 `src/routes/homeRoutes.ts`에서 관리합니다.

| 행동 | 연결 경로 | 담당 작업 |
| --- | --- | --- |
| 산 마커·검색·최근 산 선택 | `#mountains/{mountainId}/courses` | #18 코스 목록 |
| 진행 전 오늘 일정 선택 | `#hikes/today` | #15 내 등산 |
| 진행 중 오늘 일정 선택 | `#hikes/active` | #15 내 등산 |

후속 화면은 각 담당 브랜치를 병합한 뒤 App의 경로 분기에 연결합니다. 현재 홈 구현은 경로와 선택한 산 ID를 전달하며, 코스 목록·내 등산 페이지를 중복 구현하지 않습니다. 하단의 다른 탭은 Figma 주석에 따라 연결 전 안내 Toast를 표시합니다.

### 확인

`npm run test:home`로 검색·최근 산·한국 날짜 경계·화면 이동 경로를 검사합니다. Node.js 24 개발 환경을 기준으로 합니다.

개발 서버에서만 아래 주소로 일정 없는 상태와 진행 중 상태를 확인할 수 있습니다. 프로덕션 빌드에서는 검수용 쿼리를 사용하지 않습니다.

- `/?preview=home&schedule=none`
- `/?preview=home&schedule=active`

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
