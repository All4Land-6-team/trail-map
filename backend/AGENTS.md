# Backend 작업 규칙

- 공통 설정·응답·예외·감사 엔티티는 `src/main/java/com/all4land/trailmap/global`에 둔다.
- 실제 기능 코드는 `src/main/java/com/all4land/trailmap/domain/<기능명>`에 둔다.
- 일반 CRUD는 Spring Data JPA를 사용한다.
- 공간 데이터·대량·특수 SQL은 JdbcTemplate 또는 JDBC와 PostGIS SQL을 사용한다.
- 비밀값은 `src/main/resources/application-secret.properties`에 두며 Git에 커밋하지 않는다.
