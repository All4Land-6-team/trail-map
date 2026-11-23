-- 시설 제보(facility_report)는 초기 스키마(V2)에만 있고 API·화면·데이터가 없어 삭제한다.
-- 시설 상태 제보 기능을 만들 때는 그때의 요구에 맞춰 새로 설계한다.
DROP TABLE IF EXISTS facility_report;
