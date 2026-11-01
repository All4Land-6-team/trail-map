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

## 현재 migration

- `V1__enable_postgis.sql`: PostGIS 확장을 활성화합니다.
- `V2__create_core_schema.sql`: DB 명세의 핵심 테이블 15개와 FK, CHECK, UNIQUE, 조회용 B-tree 및 공간용 GiST 인덱스를 생성합니다.
- `V3__support_community_reviews_and_spots.sql`: 후기를 완료 산행과 연결하고, 공식 시설·사용자 스팟 후기와 사진, 화장실 스팟 타입, 스팟 예/아니오 투표 구조를 추가합니다.
- `V4__add_hike_record_traveled_path.sql`: 등산 기록에 GPS로 실제 이동한 경로 `traveled_path geometry(LineString, 4326)`를 추가합니다. 시작 시 코스 경로 스냅샷인 `recorded_course_geometry`와 구분합니다.
- `V5__prevent_duplicate_community_reviews.sql`: 기존 활성 중복은 최신 한 건만 남겨 소프트 삭제하고, 같은 산행 기록과 같은 산·코스·사용자 스팟·공식 시설 대상의 중복 등록을 막습니다. 다른 산행 기록이나 다른 대상의 후기는 허용합니다.
- `V6__add_community_spot_request_id.sql`: 사용자 스팟 등록 요청 ID와 사용자별 부분 유일 인덱스를 추가해 재시도 중복을 방지합니다.
- `V7__add_course_route_catalog.sql`: 후보 경로 데이터셋의 SHA-256·산 매핑과 코스별 경유지·검증 상태를 추가합니다. 기존 코스 및 분석 결과는 변경하지 않습니다.

`app_user`는 로그인·회원가입 없이 사용하는 익명 사용자를 나타냅니다. 닉네임은 NULL과 중복을 허용하며, NULL이면 애플리케이션에서 `익명{user_id}` 형식으로 표시합니다.

기본 실행 환경에서는 `classpath:db/migration`의 migration을 검증한 뒤 적용합니다. H2는 PostGIS 타입과 함수를 지원하지 않으므로 `test` 프로필에서는 Flyway를 끕니다. migration 자체는 Testcontainers의 PostgreSQL + PostGIS 환경에서 V1부터 실제로 적용하고 스키마 구성을 검증합니다.

## #95 병합 전 로컬 DB 주의사항

#95에서 사용하던 `V5__add_course_route_catalog.sql`은 develop의 V5·V6과
버전이 겹치지 않도록 V7로 이동했습니다. SQL 내용은 동일합니다.
기존 이름으로 이미 적용한 로컬 DB는 파일명 변경만으로 호환되지 않습니다.
서버 재시작 전 `flyway_schema_history`의 version·script·checksum과 코스 테이블을
확인하고 백업한 뒤 별도로 전환해야 합니다. 이력 삭제나 `repair`만으로
커뮤니티 V5를 적용한 것으로 처리하거나, 코스 테이블을 삭제하지 않습니다.
신규 DB 및 develop의 V6까지 적용된 DB는 정상 순서로 V7을 적용합니다.
