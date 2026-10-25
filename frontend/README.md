# Frontend

React, Vite, TypeScript, MapLibre GL JS 기반 프론트엔드입니다.

## 실행

```powershell
npm install
npm run dev
```

프로덕션 빌드는 `npm run build`로 확인합니다.

## 개발용 화장실 전체 조회

`npm run dev` 실행 후 `http://localhost:5173/?preview=facilities&sourceId=4`에서 적재된 화장실 후보 전체를 확인합니다. `sourceId`에는 백엔드 적재 로그의 출처 ID를 지정합니다. 현재 시범 적재는 4번 출처의 95건입니다. 이 화면은 `import.meta.env.DEV`에서만 연결되며 프로덕션 번들에 포함되지 않습니다.

백엔드는 `--facility.review.enabled=true`로 실행해야 합니다. `src/api/facilities.ts`는 `VITE_API_BASE_URL`(기본 `http://localhost:8080`)의 `/api/v1/facilities/review?sourceId=...&type=RESTROOM`을 GET으로 조회합니다. DB 비밀번호는 프론트에 설정하지 않습니다. 백엔드 기본 CORS 허용 주소는 `http://localhost:5173`입니다.

지도·목록·상세 선택, 이름·OBJECTID 검색, 전체 보기, 재조회, OBJECTID 복사를 제공합니다. 같은 좌표의 시설은 지도에서 숫자로 표시하고 마커를 반복 선택하면 해당 위치의 시설을 순서대로 선택합니다. 목록에서는 각 시설을 직접 선택할 수 있습니다. 코스 거리와 산 경계 필터를 적용하지 않은 후보 화면이며, 자료 당시의 `USE_YN`을 현재 운영 상태로 해석하지 않습니다. C·U·D 없이 조회만 수행합니다.

파일 흐름은 `App.tsx` → `pages/FacilityPreviewPage/FacilityPreviewPage.tsx` → `api/facilities.ts` → 검토 API → `FacilityPreviewMap.tsx`/`BaseMap`과 목록·상세 표시입니다. 응답 타입은 `types/facility.ts`에 있습니다. `npm run test:facilities`로 GeoJSON 검증·중복 좌표 보존·검색·API 오류 처리를 확인하고 `npm run build`로 타입과 운영 번들을 확인합니다.

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

산 마커·검색·최근 산 선택은 App의 경로 분기를 통해 산별 코스 목록으로 이동합니다. 모든 화면의 하단 탭은 `#community`·`#cart`·`#hikes/calendar`로 이동합니다. 이전 `#myHikes` 주소도 캘린더를 표시합니다.

### 확인

`npm run test:home`로 검색·최근 산·한국 날짜 경계·화면 이동 경로를 검사합니다. Node.js 24 개발 환경을 기준으로 합니다.

개발 서버에서만 아래 주소로 일정 없는 상태와 진행 중 상태를 확인할 수 있습니다. 프로덕션 빌드에서는 검수용 쿼리를 사용하지 않습니다.

- `/?preview=home&schedule=none`
- `/?preview=home&schedule=active`

## 산별 코스 목록·필터 (FLOW-02·03)

- `#mountains/{mountainId}/courses`에서 선택한 산의 코스 목록을 엽니다. 홈의 뒤로 가기와 브라우저의 앞·뒤 이동을 지원합니다.
- `src/api/courseMock.ts`의 교체 가능한 데이터 접근 함수를 사용합니다. 북한산 7개, 나머지 산 각 1개의 합성 코스이며 실제 등산로·분석값·실시간 통제정보가 아닙니다. 지도에도 예시 경로임을 표시합니다.
- 카드 Swipe·마우스 드래그·Dot 선택·지도 경로 선택은 같은 코스를 선택하고 지도 경로를 강조합니다.
- 기본 정렬은 초급→중급→고수→정보 없음이며 같은 난이도는 이름순입니다. 이름순 정렬도 제공합니다.
- 난이도 Quick Filter와 시간·거리·급경사 비율 상세 필터를 조합합니다. 목록의 `전체`는 모든 조건을 초기화합니다.
- 필터 시트 안의 변경과 초기화는 임시 선택입니다. 결과 수만 미리 계산하고 `N개 코스 보기`를 누르면 적용합니다. 닫기·Escape·시트 바깥 클릭은 임시 선택을 취소합니다.
- 시간은 `2시간 이내`에 120분 이하, `2~4시간`에 120~240분을 포함합니다. 거리 손잡이는 0~10km, 0.5km 단위이며 두 값 사이에 최소 0.5km를 유지합니다. 거리 0~10km는 거리 조건을 해제한 초기 상태입니다.
- 급경사 비율을 확인할 수 없는 코스는 급경사 조건이 적용됐을 때 결과에서 제외합니다. 미확인 값을 0으로 취급하지 않습니다.
- 적용 Chip의 ×는 해당 조건만 해제합니다. 결과가 0건이면 Empty State를 표시하고 카드와 Dot, 선택 경로를 해제합니다.
- 분석 미준비 코스의 고도 값은 `—`, 상세 버튼은 `상세 준비 중`으로 표시합니다. 예시에서 백운대 코스만 상세 이동을 허용합니다.
- 북한산 코스 지도와 담은 코스·비교 지도는 백엔드 Terrain source API의 Terrain-RGB 타일로 Hillshade와 3D 지형을 표시합니다. 2D에서는 Hillshade만 유지하고 3D에서는 Terrain과 기울기를 함께 적용합니다. 지형 정보를 불러오지 못하면 기존 2D 배경지도로 복구하고 다시 시도할 수 있습니다.
- 다른 산은 DEM이 준비될 때까지 기존 2D 배경지도와 기울기 전환 방식을 유지합니다. 현재 위치 버튼은 클릭했을 때만 위치 권한을 요청하며, 거절·조회 실패를 안내합니다.

### 담기 상태와 후속 화면 연결

`src/store/courseSelectionStore.ts`의 `useSavedCourseIds`, `getSavedCourseIds`, `setCourseSaved`, `subscribeSavedCourses`가 코스 목록·상세·등산 담기 화면의 공통 접점입니다. 담기·해제 시 Toast를 표시하며 같은 탭의 화면 이동 동안 유지하고 새로고침하면 초기화합니다. 등산 담기는 이 저장소의 코스를 산별로 묶어서 표시합니다.

`CourseListPage`의 `onCourseOpen`·`onScheduleOpen`은 `{ mountainId, courseId }`를 전달합니다. `CourseFlow`가 상세·일정 경로를 연결하며 기존 `ScheduleSheet`로 등록·수정합니다. 저장 후 해당 날짜가 선택된 캘린더로 이동합니다.

| 선택 | 경로 | 통합 작업 |
| --- | --- | --- |
| 코스 상세 | `#mountains/{mountainId}/courses/{courseId}` | #19 코스 상세 |
| 일정 등록 | `#mountains/{mountainId}/courses/{courseId}/schedule` | 공통 일정 등록 시트 |

App은 `CourseFlow`를 통해 목록·상세·일정 시트를 렌더링합니다. 일정 버튼은 공통 일정 저장소에 실제 등록된 코스에만 등록 상태를 표시합니다.

### 확인

```powershell
npm run test:courses
npm run test:terrain
npm run test:home
npm run test:offline
npm run lint -- src
npm run build
```

`test:courses`는 시간·거리·급경사 경계, 정렬, 거리 손잡이 간격, Chip 해제, 화면 이동 ID, 담기 공유 저장소를 검사합니다. `test:terrain`은 Terrain source 응답 검증, Terrain·Hillshade source 분리, 2D·3D 전환을 검사합니다.

## 코스 상세·스팟·통제정보 (FLOW-04·05)

- 02에서 백운대 코스의 상세 버튼을 누르거나 `#mountains/bukhansan/courses/bukhansan-baegundae`에 접속합니다. 목록으로 돌아가면 코스 ID를 쿼리에 전달해 선택을 유지합니다.
- 최대 폭 390px·중앙 정렬·100dvh 기준입니다. 시트의 손잡이를 터치·마우스로 드래그하거나 초점을 맞추고 ↑·↓·Home·End 키로 높이를 조절합니다. 하단 담기·일정 버튼은 고정하고 본문만 스크롤합니다.
- 고도·경사도 그래프는 #14 ECharts 구현의 모듈 등록·SVG 렌더링·크기 관찰 방식을 `components/chart/CourseProfileChart.tsx`에 확장했습니다. `types/chart.ts`는 #14와 동일 단위의 공용 고도 타입입니다.
- 그래프 터치·마우스 Drag·←·→·Home·End 조작은 가장 가까운 동일 샘플의 거리·고도·경사도·지도 좌표를 선택합니다. 고도와 경사도를 개별 표시하며, Figma V4 정책에 따라 마지막 항목 해제는 거부하고 안내 Toast를 표시합니다.
- 코스 상세에는 커뮤니티와 같은 코스 후기 중 최신 글을 최대 2개 표시합니다. `전체보기`는 커뮤니티의 해당 코스 후기 목록으로 이동하며, 뒤로 가면 진입한 코스 상세로 돌아옵니다.
- 스팟은 전체 6곳(쉼터 2·음수대 1·화장실 1·사진 스팟 2) 예시입니다. 카테고리에 따라 지도 마커·개수·목록을 함께 바꾸고, 특정 카테고리에서는 마커 이름을 표시합니다. 지도와 목록 선택이 동기화되며, 선택 시 해당 지도 위치로 이동합니다.
- 스팟 탭·카테고리·선택 ID를 URL 쿼리에 보존하여 새로고침과 담당 후기 화면에서의 복귀에 사용합니다. 스팟 탭에서 Escape를 누르면 코스 상세 탭으로 복귀합니다.
- 통제정보는 `통제정보 이미지 추가 예정` Placeholder를 표시하고 스팟 마커를 숨깁니다. 데이터 미연결 상태를 `통제 없음`으로 표시하지 않습니다.
- `api/courseDetailMock.ts`의 프로필·스팟·후기는 화면 개발용 합성 데이터입니다. 거리·상승 고도·최고 고도·급경사 비율은 02의 같은 코스 데이터를 그대로 사용합니다. 지도에도 `경로·분석 예시`를 표시합니다. 실제 등산로·시설·DEM 분석값·실시간 정보가 아닙니다.
- 분석 미준비 코스 ID에 직접 접속하면 분석 없음·후기 없음·스팟 없음 상태를 표시하고, 존재하지 않거나 산이 일치하지 않는 ID는 찾을 수 없음 상태를 표시합니다.
- 02의 지도 경로·지도 버튼 코드는 `components/map/CourseRouteMap.tsx`로 공용화했습니다. 기존 `CourseMap`은 이 컴포넌트를 사용하며, 상세는 프로필 위치와 스팟 마커를 추가합니다.

### 담당 화면과의 연결

`CourseDetailPage`는 아래 콜백을 통합 접점으로 제공합니다. App의 `CourseFlow`가 일정 시트와 커뮤니티 스팟 상세를 연결합니다.

| 연결 | 전달 정보 | 준비 범위 |
| --- | --- | --- |
| `onScheduleOpen` | `{ mountainId, courseId }` | 일정 등록·수정 담당 화면 연결 |
| `onSpotOpen` | `{ mountainId, courseId, spotId, category, returnPath }` | COMM-03 스팟 후기 화면과 같은 카테고리 복귀 |
| `hasSchedule` | 실제 일정 존재 여부 | 등록된 일정이 있을 때만 `일정 변경` 표시 |

담기는 02와 동일한 메모리 저장소를 사용하며 새로고침하면 초기화됩니다. 장바구니도 같은 저장소를 구독합니다. 새 패키지나 환경 변수·DB 설정은 추가하지 않습니다.

## 화면 흐름 연결 (#33)

- 탐색에서 담은 코스 → 산별 담은 코스 → 비교 지도 → 비교표 → FLOW-04 공통 코스 상세를 연결합니다. 공통 상세에서 뒤로 가면 `returnTo`에 보존한 `mountain`·`selected` 조건으로 비교표나 선택 화면을 복원하며, 체크 해제는 담은 코스를 삭제하지 않습니다.
- 비교할 코스는 2개 이상, 최대 3개까지 선택할 수 있습니다. 선택 화면과 URL 복원 과정에서 모두 3개 초과 선택을 제한합니다.
- 목록·상세 일정 버튼은 기존 `ScheduleSheet`, 담기 화면은 기존 `ScheduleRegistrationSheet`를 사용합니다. 두 진입점 모두 `hikeScheduleStore`에 저장하며 같은 날짜 대체 확인 후 캘린더에 반영합니다.
- 일정 상세의 코스 보기 → 코스 상세 → 스팟 상세 → 원래 카테고리 → 일정 상세로 돌아올 수 있도록 `returnTo`를 전달합니다.
- 홈 오늘 일정 → 위치 권한 안내 → 알림 선택 → 등산 중 → 종료 확인/하산 → 완료 → 산 후기 작성을 연결합니다. `hikeSessionStore`가 코스·알림·진행 단계·시작/완료 시각과 완료 산행 목록을 유지합니다. 커뮤니티 코스 후기는 같은 산에서 최근 24시간 안에 완료한 코스 중 하나를 선택하며, 같은 코스를 여러 번 완료했다면 최신 기록만 표시합니다.
- 등산 중 공유 → 새 스팟 등록 → 원래 산행 화면으로 돌아옵니다. 등록 스팟과 후기는 `communityStore`로 화면 이동 중 유지합니다.
- 상태는 같은 브라우저 탭의 메모리에서만 유지합니다. 새로고침 시 초기화되며 서버 저장, GPS 이동 기록, 실제 근접 알림은 이번 작업에 포함하지 않습니다. 미연결 이동 거리는 완료 화면에서 `기록 없음`으로 표시합니다. 예시 코스만 분석값이 있으며 미준비 상세 버튼은 계속 비활성화합니다.

### 회귀 확인

```sh
node --test tests/*.test.mjs tests/*.test.cjs
npm run lint
npm run build
```

브라우저에서는 홈에서 코스를 담은 후 비교/단독 상세/일정 등록, 캘린더 수정·대체, 스팟 상세 복귀, 오늘 산행 시작·종료·후기 이동을 확인합니다. 위치 허용 검증에는 테스트 브라우저의 모의 위치를 사용하며 실제 GPS 추적 검증과는 구분합니다.

### 확인

```powershell
npm run test:course-detail
npm run test:courses
npm run test:home
npm run test:offline
npm run lint -- src
npm run build
```

`test:course-detail`은 그래프 샘플 선택·경계·지도 좌표 보간·마지막 표시 항목 유지·스팟 필터·후기 복귀 경로를 검사합니다. 브라우저에서는 목록→상세 이동, 그래프·지도 연동, 시트 드래그와 후기 스크롤, 담기 공유, 카테고리·통제정보, 빈 상태와 320×480·390×844·1280×900 배치를 확인합니다.

## 지도 바텀 시트 높이 조절

홈 산 탐색·코스 목록·코스 상세의 손잡이를 터치·마우스로 끌거나, 초점을 맞춘 뒤 ↑·↓·Home·End로 높이를 조절합니다. Home은 최대 높이, End는 최소 높이이며, 상단 지도 영역과 하단 내비게이션을 유지합니다. 줄어든 시트의 내용은 내부에서 스크롤합니다.

`hooks/useResizableMapSheet.ts`에서 세 화면의 크기 조절과 취소·화면 크기 변경 처리를 공유합니다. 지도 영역은 고정하고 시트 높이만 `requestAnimationFrame`으로 갱신하며, 드래그 중에는 지도 크기나 경로 맞춤을 변경하지 않습니다. 초기 시트에 가려지는 영역을 제외해 경로를 맞추고, 이후 시트를 조절해도 사용자가 보고 있던 지도 위치를 유지합니다.

`npm run test:sheets`는 화면 크기·내비게이션 안전 영역·기본 높이·조절 범위를 검사합니다. 브라우저에서는 연속 드래그, 포인터 취소, 키보드 조절, 내부 스크롤, 지도·차트 유지 및 작은 화면 배치를 함께 확인합니다.

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
| `VITE_HIKE_USER_ID` | 로그인 전 임시 사용자 번호. 등산 일정 API 요청의 `X-User-Id` 헤더로 보냅니다 | `1` |

## 등산 일정 API 연동

내 등산 화면과 일정 등록 시트는 앱이 켜질 때 `VITE_API_BASE_URL`의 등산 일정 API(`/api/v1/hike-schedules`)에 한 번 요청합니다. 응답하면 일정을 API로 저장·조회하고, 응답하지 않으면(약 2.5초) 예시 일정으로 동작합니다. 백엔드를 켜지 않아도 화면은 지금처럼 확인할 수 있습니다.

코스 데이터와 코스 API가 아직 없어 화면 코스 ID를 개발용 DB 코스 번호로 임시 매핑합니다(`src/constants/hikeCourseIds.ts`). API로 확인하려면 빈 개발 DB에 `backend/docs/dev-seed-hike-courses.sql`을 한 번 실행해 같은 번호의 산·코스와 임시 사용자(1번)를 넣습니다. 코스 데이터가 들어오면 두 파일을 함께 지웁니다.

## 오프라인 캐시 정책

OpenFreeMap 배경지도는 공급원의 HTTP 응답에 따른 기본 브라우저 캐시를 사용합니다. 현재 앱은 OpenFreeMap 스타일·벡터 타일을 서비스 워커나 Cache Storage에 별도로 저장하거나 지역 단위로 미리 내려받지 않습니다. 브라우저 캐시는 저장 여부와 보존 기간을 브라우저가 결정하므로, 방문한 배경지도가 오프라인에서 항상 보인다고 보장하지 않습니다.

[OpenFreeMap의 공식 안내](https://openfreemap.org/quick_start/)에 따르면 오프라인 다운로드는 1회 최대 3,000타일 또는 50MB, 동시 요청 최대 4개, 앱을 식별하는 고유 User-Agent 조건에서 허용됩니다. 이 제한을 넘는 다운로드는 공급원에 별도 문의가 필요합니다. 앱에서 별도 저장 기능을 도입할 때는 이 조건과 [이용약관](https://openfreemap.org/tos/)을 다시 확인합니다.

등산로·시설물의 공개 정적 API가 준비되면 `VITE_OFFLINE_STATIC_GEO_URLS`에 정확한 조회 주소를 지정합니다. 지정한 주소로 실제 요청한 성공 응답만 별도 캐시에 저장하며, 네트워크가 끊기면 이전에 방문한 동일 요청(URL과 쿼리 포함)의 응답을 사용합니다. 주소가 아직 없어 기본값은 빈 목록입니다. 이 목록에는 개인화 데이터나 실시간 정보 주소를 넣지 않습니다. 인증 헤더가 포함된 요청은 캐시하지 않습니다.

프로덕션 빌드에는 서비스 워커가 앱 셸의 HTML·JavaScript·CSS와 화면에 쓰는 SVG를 사전 캐시합니다. 처음 온라인으로 접속해 서비스 워커 설치가 끝난 뒤에는 같은 범위의 앱 화면을 오프라인에서 열 수 있습니다. 개발 서버에서는 사전 캐시가 비활성화되므로 `npm run build` 후 `npm run preview`로 확인합니다.

연결이 끊기면 지도 위에 오프라인 상태와 실시간 정보 제한을 알립니다. 저장되지 않은 배경지도 요청과 정적 데이터 요청은 각각 별도로 안내합니다. 배경지도는 공급원 정책에 따라 별도 저장하지 않으므로 방문 지역이라도 오프라인 표시를 보장하지 않습니다. 서비스 워커의 캐시 동작은 `npm run test:offline`로 검사합니다.

## 코스 주변 화장실 조회

개발 서버에서 홈 → 북한산 → 백운대 코스 상세 → 스팟·통제정보 → 화장실로 이동한다. 직접 주소는 `http://localhost:5173/#mountains/bukhansan/courses/bukhansan-baegundae?tab=spots&category=restroom`이다. 기존 코스별 API를 사용하므로 검토 API의 `facility.review.enabled` 설정은 필요하지 않다.

현재 로컬 시범 데이터는 프론트의 mock 백운대 경로를 DB 코스 ID 2에 적재한 것이다. `VITE_MOCK_BAEGUNDAE_COURSE_ID`로 다른 로컬 ID를 지정할 수 있으며, 생략하면 개발 서버에서만 2를 사용한다. 운영 빌드에는 mock 코스 ID를 연결하지 않는다. 이후 실제 코스 데이터를 연결할 때는 `Course.backendCourseId`에 해당 DB ID를 제공하고 지도 경로도 같은 DB 코스의 좌표를 사용해야 한다.

`CourseDetailPage` → `useCourseFacilities` → `api/courseFacilities.ts` → `GET /api/v1/courses/{courseId}/facilities?type=RESTROOM&radiusMeters=250` → `utils/courseFacilities.ts` → `CourseSpots`와 `CourseRouteMap` 순서로 읽는다. 검토 API의 GeoJSON과 달리 코스 API는 `SuccessResponse.data` 배열을 반환한다. 프론트는 R만 수행하며 시설·코스를 생성하거나 변경하지 않는다.

화장실 및 전체 탭은 같은 API 결과를 사용한다. 합성 화장실은 제거하며 오류·빈 응답에 대한 대체 데이터로도 표시하지 않는다. 화장실 목록 선택은 지도 위치로 이동하고, 다른 예시 스팟의 후기 이동은 기존대로 동작한다. 미연결 코스·조회 중·실패와 재시도·결과 없음 상태를 구분한다.

250m는 시설 Point에서 코스 전체 LineString까지의 최단거리이며 도보 이동거리가 아니다. 코스는 9개 점의 합성 경로(약 1.2km)로 화면 분석 예시의 4.2km와 다르다. 화장실 위치는 원본 자료의 좌표이며, 원본 기준일을 표시하고 과거 상태를 현재 운영 여부로 해석하지 않는다. 쉼터·음수대·사진 스팟은 아직 화면 예시다.

`npm run test:course-facilities`, `npm run test:course-detail`, `npm run test:facilities`, `npm run lint`, `npm run build`로 API 계약·화장실 합성 데이터 제거·조회 실패 및 취소·기존 화면 로직·타입을 확인한다.
