# Backend

Java 21, Spring Boot, PostgreSQL/PostGIS 기반 백엔드입니다.

## 실행

1. `src/main/resources/application-secret.properties` 파일을 로컬에서 만들고 DB/R2 값을 설정합니다.
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

## 코드 구조

- 공통 설정·응답·예외·감사 엔티티는 `global`에 둡니다.
- 실제 도메인 코드는 `domain/<도메인명>` 아래에 생성합니다.
- 각 도메인은 `entity`, `repository`, `service`, `controller`, `dto/request`, `dto/response`, `error`, `exception` 구조를 따릅니다.

## 데이터 접근

- 일반 CRUD는 Spring Data JPA를 사용합니다.
- 공간 데이터·대량·특수 SQL은 JdbcTemplate 또는 JDBC와 PostGIS SQL을 사용합니다.
- SQL은 Repository 계층에만 둡니다.
- Controller는 Repository를 직접 호출하지 않습니다.
- JPA와 JdbcTemplate을 함께 사용할 때 트랜잭션 경계는 Service 계층에 둡니다.
- `application-secret.properties`와 실제 비밀값은 커밋하지 않습니다.

## DB 변경

DB 스키마, PostGIS, Flyway migration 작업 시 `docs/migration.md`를 확인합니다.
