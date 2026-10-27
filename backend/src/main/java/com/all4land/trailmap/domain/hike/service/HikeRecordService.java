package com.all4land.trailmap.domain.hike.service;

import com.all4land.trailmap.domain.hike.dto.request.HikePositionsRequest;
import com.all4land.trailmap.domain.hike.dto.request.HikeRecordStartRequest;
import com.all4land.trailmap.domain.hike.dto.response.HikePositionsResponse;
import com.all4land.trailmap.domain.hike.dto.response.HikeRecordResponse;
import com.all4land.trailmap.domain.hike.entity.HikeSchedule;
import com.all4land.trailmap.domain.hike.error.HikeErrorCode;
import com.all4land.trailmap.domain.hike.exception.HikeException;
import com.all4land.trailmap.domain.hike.repository.HikeCourseRepository;
import com.all4land.trailmap.domain.hike.repository.HikeRecordRepository;
import com.all4land.trailmap.domain.hike.repository.HikeRecordRow;
import com.all4land.trailmap.domain.hike.repository.HikeScheduleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

import static com.all4land.trailmap.domain.hike.service.HikeScheduleService.SCHEDULE_ZONE;

/** 등산 시작 → 위치 기록 → 하산 → 종료. 상태는 IN_PROGRESS → DESCENDING → COMPLETED 순서로만 바뀐다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HikeRecordService {

    /** 수평 정확도가 이보다 나쁜 위치는 경로에서 뺀다. */
    static final double MAX_ACCURACY_METERS = 50;
    /** 직전 위치와 이보다 가까우면 제자리 GPS 흔들림으로 보고 뺀다. */
    static final double MIN_STEP_METERS = 5;
    private static final double EARTH_RADIUS_METERS = 6_371_008.8;

    private final HikeRecordRepository recordRepository;
    private final HikeScheduleRepository scheduleRepository;
    private final HikeCourseRepository courseRepository;

    @Transactional
    public HikeRecordResponse start(Long userId, HikeRecordStartRequest request) {
        validateUser(userId);
        HikeSchedule schedule = scheduleRepository.findByScheduleIdAndUserIdAndDeletedAtIsNull(request.scheduleId(), userId)
                .orElseThrow(() -> new HikeException(HikeErrorCode.SCHEDULE_NOT_FOUND));

        OffsetDateTime now = OffsetDateTime.now(SCHEDULE_ZONE);
        LocalDate scheduleDate = schedule.getScheduledStartsAt().atZoneSameInstant(SCHEDULE_ZONE).toLocalDate();
        if (!scheduleDate.equals(now.toLocalDate())) {
            throw new HikeException(HikeErrorCode.SCHEDULE_NOT_TODAY);
        }
        if (recordRepository.existsBySchedule(schedule.getScheduleId())) {
            throw new HikeException(HikeErrorCode.RECORD_ALREADY_EXISTS);
        }
        if (recordRepository.findActive(userId).isPresent()) {
            throw new HikeException(HikeErrorCode.ACTIVE_RECORD_EXISTS);
        }

        Long hikeRecordId;
        try {
            hikeRecordId = recordRepository.start(userId, schedule.getScheduleId(), now);
        } catch (DataIntegrityViolationException exception) {
            // 같은 사용자가 동시에 시작한 경우 uq_hike_record_schedule·uq_hike_record_active_user에서 걸린다.
            throw new HikeException(HikeErrorCode.ACTIVE_RECORD_EXISTS);
        }
        return toResponse(getOwnedRecord(userId, hikeRecordId));
    }

    /** 앱을 다시 열었을 때 이어 갈 진행 중 기록. 없으면 null. */
    public HikeRecordResponse getActive(Long userId) {
        validateUser(userId);
        return recordRepository.findActive(userId).map(this::toResponse).orElse(null);
    }

    public HikeRecordResponse getRecord(Long userId, Long hikeRecordId) {
        validateUser(userId);
        return toResponse(getOwnedRecord(userId, hikeRecordId));
    }

    @Transactional
    public HikePositionsResponse addPositions(Long userId, Long hikeRecordId, HikePositionsRequest request) {
        validateUser(userId);
        HikeRecordRow record = getOwnedRecord(userId, hikeRecordId);
        if (record.isCompleted()) {
            throw new HikeException(HikeErrorCode.RECORD_ALREADY_COMPLETED);
        }

        List<HikePositionsRequest.Position> accepted = acceptPositions(record, request.positions());
        if (accepted.isEmpty()) {
            return new HikePositionsResponse(hikeRecordId, 0, record.traveledDistanceMeters());
        }
        recordRepository.appendPath(hikeRecordId, toLineStringWkt(accepted), OffsetDateTime.now(SCHEDULE_ZONE));
        return new HikePositionsResponse(
                hikeRecordId, accepted.size(), getOwnedRecord(userId, hikeRecordId).traveledDistanceMeters()
        );
    }

    /** 하산 시작. 이미 하산 중이면 그대로 둔다. */
    @Transactional
    public HikeRecordResponse descend(Long userId, Long hikeRecordId) {
        validateUser(userId);
        HikeRecordRow record = getOwnedRecord(userId, hikeRecordId);
        if (record.isCompleted()) {
            throw new HikeException(HikeErrorCode.RECORD_ALREADY_COMPLETED);
        }
        recordRepository.descend(hikeRecordId, OffsetDateTime.now(SCHEDULE_ZONE));
        return toResponse(getOwnedRecord(userId, hikeRecordId));
    }

    /** 등산 종료. 이미 종료된 기록이면 다시 계산하지 않고 그 기록을 돌려준다 (재시도 대비). */
    @Transactional
    public HikeRecordResponse finish(Long userId, Long hikeRecordId) {
        validateUser(userId);
        HikeRecordRow record = getOwnedRecord(userId, hikeRecordId);
        if (!record.isCompleted()) {
            recordRepository.finish(hikeRecordId, OffsetDateTime.now(SCHEDULE_ZONE));
        }
        return toResponse(getOwnedRecord(userId, hikeRecordId));
    }

    /** 측정 시각 순으로 정렬한 뒤 정확도가 낮은 위치와 직전 위치에서 거의 움직이지 않은 위치를 뺀다. */
    private static List<HikePositionsRequest.Position> acceptPositions(
            HikeRecordRow record, List<HikePositionsRequest.Position> positions
    ) {
        List<HikePositionsRequest.Position> accepted = new ArrayList<>();
        Double previousLongitude = record.lastLongitude();
        Double previousLatitude = record.lastLatitude();
        List<HikePositionsRequest.Position> ordered = positions.stream()
                .sorted(Comparator.comparing(HikePositionsRequest.Position::recordedAt))
                .toList();
        for (HikePositionsRequest.Position position : ordered) {
            if (position.accuracyMeters() != null && position.accuracyMeters() > MAX_ACCURACY_METERS) {
                continue;
            }
            if (previousLongitude != null && distanceMeters(
                    previousLongitude, previousLatitude, position.longitude(), position.latitude()
            ) < MIN_STEP_METERS) {
                continue;
            }
            accepted.add(position);
            previousLongitude = position.longitude();
            previousLatitude = position.latitude();
        }
        return accepted;
    }

    /** 위치가 하나뿐이면 같은 점 두 개로 선을 만든다. 이어 붙일 때 중복 점은 저장소에서 지운다. */
    private static String toLineStringWkt(List<HikePositionsRequest.Position> positions) {
        List<HikePositionsRequest.Position> points = positions.size() == 1
                ? List.of(positions.get(0), positions.get(0))
                : positions;
        return points.stream()
                .map(position -> position.longitude() + " " + position.latitude())
                .collect(Collectors.joining(",", "LINESTRING(", ")"));
    }

    /** 하버사인 거리. 걸러내기용 근사값이고, 저장하는 이동 거리는 PostGIS geography로 계산한다. */
    private static double distanceMeters(double fromLongitude, double fromLatitude, double toLongitude, double toLatitude) {
        double latitudeDelta = Math.toRadians(toLatitude - fromLatitude);
        double longitudeDelta = Math.toRadians(toLongitude - fromLongitude);
        double a = Math.pow(Math.sin(latitudeDelta / 2), 2)
                + Math.cos(Math.toRadians(fromLatitude)) * Math.cos(Math.toRadians(toLatitude))
                * Math.pow(Math.sin(longitudeDelta / 2), 2);
        return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
    }

    private HikeRecordResponse toResponse(HikeRecordRow record) {
        return HikeRecordResponse.of(
                record,
                courseRepository.findCourseSummary(record.courseId())
                        .orElseThrow(() -> new HikeException(HikeErrorCode.COURSE_NOT_FOUND)),
                recordRepository.findTraveledPath(record.hikeRecordId())
        );
    }

    private void validateUser(Long userId) {
        if (!courseRepository.existsUser(userId)) {
            throw new HikeException(HikeErrorCode.USER_NOT_FOUND);
        }
    }

    /** 다른 사용자의 기록은 존재 여부를 드러내지 않도록 없는 기록과 같게 처리한다. */
    private HikeRecordRow getOwnedRecord(Long userId, Long hikeRecordId) {
        return recordRepository.findOwned(userId, hikeRecordId)
                .orElseThrow(() -> new HikeException(HikeErrorCode.RECORD_NOT_FOUND));
    }
}
