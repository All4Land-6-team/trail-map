# Supabase 공용 개발 DB

Supabase는 공용 PostgreSQL/PostGIS 개발 DB로만 사용한다. 프론트엔드는
Supabase에 직접 연결하지 않고 기존처럼 Spring API를 호출한다. 로그인과 세션도
Spring 인증 구현을 유지한다.

## 사전 조건

- Supabase 프로젝트의 `postgis` 확장을 `extensions` schema에 활성화한다.
- 로컬 Spring 백엔드는 Session pooler의 5432 포트를 사용한다.
- 실제 비밀번호와 완성된 연결 문자열은 Git, 이슈, PR, 메신저에 남기지 않는다.

## Spring 연결 설정

Supabase의 PostgreSQL URI를 그대로 `DB_URL`에 넣지 않는다. Spring JDBC URL은
`jdbc:postgresql://`로 시작하며 비밀번호를 URL에서 분리한다.

```text
DB_URL=jdbc:postgresql://<SESSION_POOLER_HOST>:5432/postgres?sslmode=require
DB_USERNAME=postgres.<PROJECT_REF>
DB_PASSWORD=<DB_PASSWORD>
DB_POOL_SIZE=5
```

비밀번호에 `@`가 포함되어도 `DB_PASSWORD`에 분리해 저장하면 URL 인코딩하지
않는다.

환경 변수 대신 로컬 비밀 설정을 사용하려면
`src/main/resources/application-secret.properties.example`을
`src/main/resources/application-secret.properties`로 복사한 뒤 자리표시자를
바꾼다. 실제 파일은 Git에서 제외된다.

```properties
spring.datasource.url=jdbc:postgresql://<SESSION_POOLER_HOST>:5432/postgres?sslmode=require
spring.datasource.username=postgres.<PROJECT_REF>
spring.datasource.password=<DB_PASSWORD>
spring.datasource.hikari.maximum-pool-size=5
```

아무 설정도 하지 않으면 `application.properties`의 기본값에 따라 기존 로컬
`jdbc:postgresql://localhost:5432/trail_map` DB를 사용한다. 로컬 DB도
`DB_PASSWORD` 또는 로컬 비밀 설정이 필요하다.

## Migration 적용

빈 Supabase DB에 처음 연결해 백엔드를 실행하면 Flyway가 V1부터 현재 버전까지
순서대로 적용한다. 여러 팀원이 동시에 schema를 직접 변경하지 않고 모든 변경은
새 Flyway migration으로 커밋한다.

실행 전에 대상 DB가 공용 개발 프로젝트인지 확인한다. 자동화 테스트와 데이터
삭제 테스트는 공용 DB가 아닌 H2, Testcontainers 또는 별도 로컬 DB를 사용한다.

## 검증

백엔드가 정상 시작된 뒤 Supabase SQL Editor에서 아래 항목을 확인한다.

```sql
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'postgis';

SELECT version, description, success
FROM flyway_schema_history
ORDER BY installed_rank;

SELECT
    course_id,
    GeometryType(course_geometry) AS geometry_type,
    ST_SRID(course_geometry) AS srid,
    ST_IsValid(course_geometry) AS is_valid
FROM course
LIMIT 10;
```

PostGIS가 조회되고, Flyway의 모든 행이 `success=true`이며, 코스 경로가
`LINESTRING`, SRID 4326, 유효한 geometry이면 기본 연결과 공간 schema 적용이
완료된 것이다.

## 데이터 이전 원칙

- 산, 코스, 시설, 검증된 코스 분석 결과처럼 공식 개발 데이터만 선별한다.
- 테스트 회원, 로그인 세션, 임시 후기와 일정은 기본 이전 대상에서 제외한다.
- geometry를 포함한 데이터는 CSV보다 `pg_dump`/`pg_restore` 또는 프로젝트의
  검증된 적재기를 우선한다.
- 이전 전후 테이블 건수, SRID, geometry 타입과 유효성을 비교한다.
- Terrain-RGB PNG와 DEM 원본은 DB 데이터가 아니므로 별도 파일 저장소에서
  관리한다.

## 코스 분석 문서 (#116)

`course-analysis.storage=database`가 기본값이다. V10부터 분석 요약과 전체 프로필
문서를 같은 `course_analysis` 행에 저장하므로, 동일 DB에 연결한 백엔드들은
별도 로컬 프로필 파일이나 업로드 키 없이 기존 API로 조회한다. CLI도 같은 DB와
같은 저장 모드를 사용하며, JAR 실행 시 외부 비밀 설정을 명시한다. 실행 예시는
[백엔드 README](../README.md#분석-결과-적재)를 참고한다.

DB 연결이나 V10 적용만으로 DEM 분석 결과가 생성되지는 않는다. 대상 DB의 현재
코스 ID·버전·경로로 분석한 결과를 검증·적재해야 한다. 기존 로컬 시드 분석이나
그 분석 ID의 파일을 공용 DB의 같은 번호에 복사하지 않는다. 공용 코스 경로·안내가
이미 적재돼 있으면 중복 적재할 필요가 없지만 원본 GeoJSON·안내 JSON과 분석용
DEM은 검증·재분석을 위해 보관한다. Terrain-RGB 타일은 분석용 DEM을 대체하지 않는다.

과거 파일 방식은 명시적인 `course-analysis.storage=file`과 원래 DB·파일 저장소로
유지한다. 모드 변경만으로 파일 문서가 DB에 이전되지 않으며, `database` 모드는
문서가 없는 분석 행을 로컬 파일로 대체하지 않는다.
