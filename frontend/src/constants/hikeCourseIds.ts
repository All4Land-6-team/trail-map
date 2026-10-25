/**
 * 화면 임시 코스 ID → 개발용 DB 코스 번호 (이슈 #61).
 * backend/docs/dev-seed-hike-courses.sql로 넣은 course_id와 같아야 한다.
 * 코스 데이터 적재·코스 API가 생기면 이 파일과 시드 SQL을 함께 지운다.
 */
export const DEV_COURSE_IDS: Readonly<Record<string, number>> = {
  "bukhansan-baegundae": 1,
  "daenammun": 2,
  "bibong": 3,
  "sumunbyeok": 4,
  "bukhansan-bogukmun": 5,
  "bukhansan-uiryeong": 6,
  "bukhansan-samobawi": 7,
  "dobongsan-sinseondae": 8,
  "seoraksan-biseondae": 9,
  "gwanaksan-yeonjudae": 10,
  "jirisan-cheonwangbong": 11,
};
