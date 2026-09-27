# 프로젝트 작업 규칙

## Frontend

- 페이지 전용 UI는 `frontend/src/pages/<PageName>/components`에 둔다.
- 여러 페이지에서 재사용하는 UI는 `frontend/src/components`에 둔다.
- MapLibre 공용 컴포넌트와 지도 공용 코드는 `frontend/src/components/map`에 둔다.
- API 요청은 `frontend/src/api`, 재사용 Hook은 `frontend/src/hooks`에 둔다.
- 공용 타입은 `frontend/src/types`, 순수 유틸 함수는 `frontend/src/utils`에 둔다.
- 고정 설정값은 `frontend/src/constants`에 둔다.
- 비밀값은 커밋하지 않고 `.env.example`에 키 이름과 예시만 둔다.
