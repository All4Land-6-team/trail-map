# DB Migration 규칙

DB 스키마 변경은 Flyway migration SQL 파일로만 수행합니다.

1. 공유된 migration 파일은 수정하지 않고 새 버전을 추가합니다.
2. 파일명은 `V번호__작업명.sql` 형식을 사용합니다.
3. PostGIS 확장은 첫 migration에서 활성화합니다.
4. geometry 컬럼에는 타입과 SRID를 명시합니다.
5. 공간 인덱스는 필요 시 GiST 인덱스를 추가합니다.
6. 공유 DB에서는 JPA `ddl-auto`에 `create`, `update`를 사용하지 않고 `validate`를 사용합니다.
7. 실제 SQL 파일은 `src/main/resources/db/migration/`에 둡니다.

`V1__enable_postgis.sql`은 PostgreSQL/PostGIS 환경에서만 실행합니다. H2 기반 단위 테스트 프로필에서는 Flyway를 비활성화합니다.
