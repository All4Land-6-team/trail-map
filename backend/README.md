# Backend

Java 21, Spring Boot, PostgreSQL/PostGIS 기반 백엔드입니다.

## 실행

1. `src/main/resources/application-secret.properties`을 복사해 `application-secret.properties`를 만들고 DB/R2 값을 설정합니다.
2. PostgreSQL + PostGIS를 실행합니다.
3. Windows에서는 다음 명령으로 서버를 실행합니다.

```powershell
.\gradlew.bat bootRun
```

테스트와 빌드는 다음 명령으로 확인합니다.

```powershell
.\gradlew.bat test
.\gradlew.bat bootJar
```

## 코드 규칙

- 공통 설정·응답·예외·감사 엔티티는 `global`에 둡니다.
- 기능 코드는 `feature/<기능명>` 아래에 생성합니다.
- 일반 CRUD는 Spring Data JPA를 사용합니다.
- 공간 데이터·대량·특수 SQL은 JdbcTemplate 또는 JDBC와 PostGIS SQL을 사용합니다.
- `application-secret.properties`와 실제 비밀값은 커밋하지 않습니다.
