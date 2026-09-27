# 프로젝트 작업 규칙

## Frontend

- 페이지 전용 UI는 `frontend/src/pages/<PageName>/components`에 둔다.
- 여러 페이지에서 재사용하는 UI는 `frontend/src/components`에 둔다.
- MapLibre 공용 컴포넌트와 지도 공용 코드는 `frontend/src/components/map`에 둔다.
- API 요청은 `frontend/src/api`, 재사용 Hook은 `frontend/src/hooks`에 둔다.
- 공용 타입은 `frontend/src/types`, 순수 유틸 함수는 `frontend/src/utils`에 둔다.
- 고정 설정값은 `frontend/src/constants`에 둔다.
- 비밀값은 커밋하지 않고 `.env.example`에 키 이름과 예시만 둔다.

## Backend

- 공통 설정·응답·예외·감사 엔티티는 `backend/src/main/java/com/all4land/trailmap/global`에 둔다.
- 실제 기능 코드는 `backend/src/main/java/com/all4land/trailmap/domain/<기능명>`에 둔다.
- 일반 CRUD는 Spring Data JPA를 사용한다.
- 공간 데이터·대량·특수 SQL은 JdbcTemplate 또는 JDBC와 PostGIS SQL을 사용한다.
- 비밀값은 `application-secret.properties`에 두며 Git에 커밋하지 않는다.
