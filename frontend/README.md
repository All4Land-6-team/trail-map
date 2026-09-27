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
