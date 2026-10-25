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

## Terrain-RGB 타일 API

북한산 Terrain-RGB 산출물은 프로젝트 루트의
`data/processed/dem/bukhansan/terrain`에 둡니다. 다른 경로를 사용하거나
프론트엔드에서 접근할 공개 주소가 달라지는 경우 다음 환경 변수를 설정합니다.

```text
TERRAIN_ROOT_PATH=/absolute/path/to/terrain
TERRAIN_TILES_URL=http://localhost:8080/api/v1/terrain/{z}/{x}/{y}.png
TERRAIN_CACHE_MAX_AGE=PT1H
```

- `GET /api/v1/terrain/tilejson`: TileJSON 메타데이터
- `GET /api/v1/terrain/source`: MapLibre `raster-dem` source 설정
- `GET /api/v1/terrain/{z}/{x}/{y}.png`: Terrain-RGB PNG 타일

로컬 기본값은 백엔드 `http://localhost:8080`과 프로젝트 루트의 Terrain
산출물 경로를 사용합니다. 타일 파일을 교체한 경우 메타데이터 캐시 갱신을 위해
백엔드를 다시 실행합니다.

## 공식 시설 데이터

화장실 시범 전처리·JDBC 적재·조회 API·검증 방법은 [시설 데이터 문서](../docs/facilities.md)를 참고합니다.
