# Domain package example

새 기능은 `domain/<기능명>` 아래에 같은 구조로 생성합니다.

- `controller`: HTTP 요청과 응답
- `service`: 비즈니스 로직
- `repository`: JPA 또는 JdbcTemplate/JDBC 데이터 접근
- `dto`: 요청·응답 객체
- `entity`: JPA 엔티티

공간 데이터나 대량·특수 SQL은 `repository`에서 JdbcTemplate 또는 JDBC와 PostGIS SQL을 사용합니다.
