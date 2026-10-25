package com.all4land.trailmap.domain.hike.service;

import com.all4land.trailmap.domain.hike.dto.request.HikeScheduleCreateRequest;
import com.all4land.trailmap.domain.hike.dto.request.HikeScheduleUpdateRequest;
import com.all4land.trailmap.domain.hike.dto.response.HikeScheduleResponse;
import com.all4land.trailmap.domain.hike.dto.response.HikeRecordCompletionResponse;
import com.all4land.trailmap.domain.hike.entity.HikeSchedule;
import com.all4land.trailmap.domain.hike.error.HikeErrorCode;
import com.all4land.trailmap.domain.hike.exception.HikeException;
import com.all4land.trailmap.domain.hike.repository.HikeCourseRepository;
import com.all4land.trailmap.domain.hike.repository.HikeCourseSummary;
import com.all4land.trailmap.domain.hike.repository.HikeScheduleRepository;
import com.all4land.trailmap.domain.hike.repository.HikeRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HikeScheduleService {

    /** 일정 날짜와 하루 1개 규칙(uq_hike_schedule_day)의 기준 시간대 */
    public static final ZoneId SCHEDULE_ZONE = ZoneId.of("Asia/Seoul");
    private static final long MAX_PERIOD_DAYS = 366;

    private final HikeScheduleRepository scheduleRepository;
    private final HikeCourseRepository courseRepository;
    private final HikeRecordRepository recordRepository;

    @Transactional
    public HikeScheduleResponse create(Long userId, HikeScheduleCreateRequest request) {
        validateUser(userId);
        HikeCourseSummary course = getCourse(request.courseId());

        clearDay(userId, request.date(), null, request.replaceExisting());
        HikeSchedule schedule = HikeSchedule.create(userId, course.courseId(), toStartsAt(request.date(), request.startTime()));
        try {
            schedule = scheduleRepository.saveAndFlush(schedule);
        } catch (DataIntegrityViolationException exception) {
            // 같은 날짜에 동시에 등록된 경우 유니크 인덱스에서 걸린다.
            throw new HikeException(HikeErrorCode.SCHEDULE_ALREADY_EXISTS);
        }
        return HikeScheduleResponse.of(schedule, course, SCHEDULE_ZONE);
    }

    public List<HikeScheduleResponse> getSchedules(Long userId, LocalDate from, LocalDate to) {
        if (to.isBefore(from) || ChronoUnit.DAYS.between(from, to) >= MAX_PERIOD_DAYS) {
            throw new HikeException(HikeErrorCode.INVALID_SCHEDULE_PERIOD);
        }
        validateUser(userId);

        List<HikeSchedule> schedules = scheduleRepository.findActiveSchedules(
                userId, startOfDay(from), startOfDay(to.plusDays(1))
        );
        Map<Long, HikeCourseSummary> courses = courseRepository.findCourseSummaries(
                schedules.stream().map(HikeSchedule::getCourseId).distinct().toList()
        );
        return schedules.stream()
                .map(schedule -> HikeScheduleResponse.of(schedule, courses.get(schedule.getCourseId()), SCHEDULE_ZONE))
                .toList();
    }

    public HikeScheduleResponse getSchedule(Long userId, Long scheduleId) {
        validateUser(userId);
        HikeSchedule schedule = getOwnedSchedule(userId, scheduleId);
        return HikeScheduleResponse.of(schedule, getCourse(schedule.getCourseId()), SCHEDULE_ZONE);
    }

    @Transactional
    public HikeScheduleResponse update(Long userId, Long scheduleId, HikeScheduleUpdateRequest request) {
        if (request.isEmpty()) {
            throw new HikeException(HikeErrorCode.EMPTY_SCHEDULE_UPDATE);
        }
        validateUser(userId);
        HikeSchedule schedule = getOwnedSchedule(userId, scheduleId);

        ZonedDateTime current = schedule.getScheduledStartsAt().atZoneSameInstant(SCHEDULE_ZONE);
        LocalDate date = Objects.requireNonNullElse(request.date(), current.toLocalDate());
        LocalTime startTime = Objects.requireNonNullElse(request.startTime(), current.toLocalTime());
        HikeCourseSummary course = getCourse(Objects.requireNonNullElse(request.courseId(), schedule.getCourseId()));

        clearDay(userId, date, scheduleId, request.replaceExisting());
        schedule.change(course.courseId(), toStartsAt(date, startTime));
        try {
            scheduleRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            throw new HikeException(HikeErrorCode.SCHEDULE_ALREADY_EXISTS);
        }
        return HikeScheduleResponse.of(schedule, course, SCHEDULE_ZONE);
    }

    @Transactional
    public void delete(Long userId, Long scheduleId) {
        validateUser(userId);
        getOwnedSchedule(userId, scheduleId).delete(OffsetDateTime.now(SCHEDULE_ZONE));
    }

    @Transactional
    public HikeRecordCompletionResponse complete(Long userId, Long scheduleId) {
        validateUser(userId);
        getOwnedSchedule(userId, scheduleId);
        return HikeRecordCompletionResponse.from(
                recordRepository.complete(userId, scheduleId, OffsetDateTime.now(SCHEDULE_ZONE))
        );
    }

    /**
     * 같은 날짜의 다른 일정을 비운다. 대체하지 않으면 충돌로 본다.
     * 삭제를 먼저 DB에 반영해야 새 일정 저장 시 유니크 인덱스(uq_hike_schedule_day)를 통과한다.
     */
    private void clearDay(Long userId, LocalDate date, Long keepScheduleId, boolean replaceExisting) {
        List<HikeSchedule> sameDay = scheduleRepository.findActiveSchedules(
                        userId, startOfDay(date), startOfDay(date.plusDays(1))
                ).stream()
                .filter(schedule -> !schedule.getScheduleId().equals(keepScheduleId))
                .toList();
        if (sameDay.isEmpty()) {
            return;
        }
        if (!replaceExisting) {
            throw new HikeException(HikeErrorCode.SCHEDULE_ALREADY_EXISTS);
        }

        OffsetDateTime deletedAt = OffsetDateTime.now(SCHEDULE_ZONE);
        sameDay.forEach(schedule -> schedule.delete(deletedAt));
        scheduleRepository.flush();
    }

    private void validateUser(Long userId) {
        if (!courseRepository.existsUser(userId)) {
            throw new HikeException(HikeErrorCode.USER_NOT_FOUND);
        }
    }

    private HikeCourseSummary getCourse(Long courseId) {
        return courseRepository.findCourseSummary(courseId)
                .orElseThrow(() -> new HikeException(HikeErrorCode.COURSE_NOT_FOUND));
    }

    /** 다른 사용자의 일정은 존재 여부를 드러내지 않도록 없는 일정과 같게 처리한다. */
    private HikeSchedule getOwnedSchedule(Long userId, Long scheduleId) {
        return scheduleRepository.findByScheduleIdAndUserIdAndDeletedAtIsNull(scheduleId, userId)
                .orElseThrow(() -> new HikeException(HikeErrorCode.SCHEDULE_NOT_FOUND));
    }

    private static OffsetDateTime toStartsAt(LocalDate date, LocalTime startTime) {
        return ZonedDateTime.of(date, startTime, SCHEDULE_ZONE).toOffsetDateTime();
    }

    private static OffsetDateTime startOfDay(LocalDate date) {
        return date.atStartOfDay(SCHEDULE_ZONE).toOffsetDateTime();
    }
}
