-- 등산 일정 API 개발용 시드 데이터 (이슈 #61)
-- 화면 임시 코스 데이터(frontend/src/api/courseMock.ts)와 같은 산·코스를 넣는다.
-- course_id는 frontend/src/constants/hikeCourseIds.ts의 번호와 같아야 한다.
-- 빈 개발용 DB에서 한 번만 실행한다. Flyway 마이그레이션이 아니며 운영 DB에는 실행하지 않는다.
-- 코스 데이터 적재·코스 API가 생기면 이 파일과 hikeCourseIds.ts를 함께 지운다.

BEGIN;

-- 임시 사용자 (X-User-Id: 1)
INSERT INTO app_user (user_id) OVERRIDING SYSTEM VALUE VALUES (1) ON CONFLICT DO NOTHING;

INSERT INTO data_source (source_id, source_name, source_format) OVERRIDING SYSTEM VALUE
VALUES (1, '개발용 임시 코스 데이터', 'GEOJSON') ON CONFLICT DO NOTHING;

INSERT INTO mountain (mountain_id, mountain_name, mountain_display_location, source_id, source_hash, imported_at) OVERRIDING SYSTEM VALUE VALUES
  (1, '북한산', ST_SetSRID(ST_MakePoint(126.977, 37.659), 4326), 1, encode(sha256(convert_to('dev-seed-mountain-1', 'UTF8')), 'hex'), now()),
  (2, '도봉산', ST_SetSRID(ST_MakePoint(127.034, 37.696), 4326), 1, encode(sha256(convert_to('dev-seed-mountain-2', 'UTF8')), 'hex'), now()),
  (3, '설악산', ST_SetSRID(ST_MakePoint(128.465, 38.119), 4326), 1, encode(sha256(convert_to('dev-seed-mountain-3', 'UTF8')), 'hex'), now()),
  (4, '관악산', ST_SetSRID(ST_MakePoint(126.964, 37.445), 4326), 1, encode(sha256(convert_to('dev-seed-mountain-4', 'UTF8')), 'hex'), now()),
  (5, '지리산', ST_SetSRID(ST_MakePoint(127.731, 35.337), 4326), 1, encode(sha256(convert_to('dev-seed-mountain-5', 'UTF8')), 'hex'), now())
ON CONFLICT DO NOTHING;

INSERT INTO course (course_id, mountain_id, course_name, course_geometry, official_distance_meters, official_duration_seconds, source_id, source_hash, imported_at) OVERRIDING SYSTEM VALUE VALUES
  (1, 1, '백운대 코스', ST_GeomFromText('LINESTRING(126.9905 37.662, 126.9885 37.6618, 126.9866 37.6612, 126.9852 37.6608, 126.9836 37.6603, 126.9818 37.66, 126.9803 37.6596, 126.979 37.6592, 126.9776 37.6588)', 4326), 4200, 7800, 1, encode(sha256(convert_to('dev-seed-course-01', 'UTF8')), 'hex'), now()),  -- bukhansan-baegundae
  (2, 1, '대남문 코스', ST_GeomFromText('LINESTRING(126.955 37.636, 126.963 37.644, 126.972 37.651, 126.982 37.66, 126.989 37.67, 126.993 37.681)', 4326), 5600, 9600, 1, encode(sha256(convert_to('dev-seed-course-02', 'UTF8')), 'hex'), now()),  -- daenammun
  (3, 1, '비봉 코스', ST_GeomFromText('LINESTRING(126.948 37.641, 126.956 37.648, 126.966 37.655, 126.977 37.663, 126.986 37.674, 126.992 37.682)', 4326), 3800, 7200, 1, encode(sha256(convert_to('dev-seed-course-03', 'UTF8')), 'hex'), now()),  -- bibong
  (4, 1, '숨은벽 코스', ST_GeomFromText('LINESTRING(126.962 37.633, 126.971 37.642, 126.981 37.65, 126.99 37.659, 126.997 37.67, 127.001 37.681)', 4326), 6100, 12000, 1, encode(sha256(convert_to('dev-seed-course-04', 'UTF8')), 'hex'), now()),  -- sumunbyeok
  (5, 1, '보국문 코스', ST_GeomFromText('LINESTRING(127.004 37.622, 127 37.627, 126.995 37.633, 126.99 37.64)', 4326), 2800, 4800, 1, encode(sha256(convert_to('dev-seed-course-05', 'UTF8')), 'hex'), now()),  -- bukhansan-bogukmun
  (6, 1, '우이령 코스', ST_GeomFromText('LINESTRING(127.012 37.663, 127.009 37.667, 127.005 37.671, 127 37.676)', 4326), 1800, 3000, 1, encode(sha256(convert_to('dev-seed-course-06', 'UTF8')), 'hex'), now()),  -- bukhansan-uiryeong
  (7, 1, '사모바위 코스', ST_GeomFromText('LINESTRING(126.95 37.63, 126.96 37.638, 126.97 37.647, 126.978 37.656, 126.986 37.664)', 4326), 7200, 15600, 1, encode(sha256(convert_to('dev-seed-course-07', 'UTF8')), 'hex'), now()),  -- bukhansan-samobawi
  (8, 2, '신선대 코스', ST_GeomFromText('LINESTRING(127.0465 37.6895, 127.0432 37.6907, 127.0398 37.6921, 127.0369 37.6936, 127.0341 37.6949, 127.0318 37.6963, 127.0296 37.6978)', 4326), 5100, 9600, 1, encode(sha256(convert_to('dev-seed-course-08', 'UTF8')), 'hex'), now()),  -- dobongsan-sinseondae
  (9, 3, '비선대 코스', ST_GeomFromText('LINESTRING(128.447 38.099, 128.455 38.107, 128.461 38.113, 128.465 38.119)', 4326), 4500, 9000, 1, encode(sha256(convert_to('dev-seed-course-09', 'UTF8')), 'hex'), now()),  -- seoraksan-biseondae
  (10, 4, '연주대 코스', ST_GeomFromText('LINESTRING(126.946 37.425, 126.954 37.433, 126.96 37.439, 126.964 37.445)', 4326), 4500, 9000, 1, encode(sha256(convert_to('dev-seed-course-10', 'UTF8')), 'hex'), now()),  -- gwanaksan-yeonjudae
  (11, 5, '천왕봉 코스', ST_GeomFromText('LINESTRING(127.713 35.317, 127.72099999999999 35.325, 127.72699999999999 35.331, 127.731 35.337)', 4326), 4500, 9000, 1, encode(sha256(convert_to('dev-seed-course-11', 'UTF8')), 'hex'), now())  -- jirisan-cheonwangbong
ON CONFLICT DO NOTHING;

-- 직접 번호를 넣었으므로 이후 자동 번호가 겹치지 않게 맞춘다.
SELECT setval(pg_get_serial_sequence('app_user', 'user_id'), (SELECT max(user_id) FROM app_user));
SELECT setval(pg_get_serial_sequence('data_source', 'source_id'), (SELECT max(source_id) FROM data_source));
SELECT setval(pg_get_serial_sequence('mountain', 'mountain_id'), (SELECT max(mountain_id) FROM mountain));
SELECT setval(pg_get_serial_sequence('course', 'course_id'), (SELECT max(course_id) FROM course));

COMMIT;
