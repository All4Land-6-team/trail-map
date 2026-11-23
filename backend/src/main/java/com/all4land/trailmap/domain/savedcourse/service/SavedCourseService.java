package com.all4land.trailmap.domain.savedcourse.service;

import com.all4land.trailmap.domain.savedcourse.dto.SavedCourseResponse;
import com.all4land.trailmap.domain.savedcourse.error.SavedCourseErrorCode;
import com.all4land.trailmap.domain.savedcourse.exception.SavedCourseException;
import com.all4land.trailmap.domain.savedcourse.repository.SavedCourseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** 등산 담기를 계정에 저장한다. 담기·빼기는 여러 번 눌러도 결과가 같다. */
@Service
@RequiredArgsConstructor
public class SavedCourseService {

    private final SavedCourseRepository repository;

    @Transactional(readOnly = true)
    public List<SavedCourseResponse> getSavedCourses(Long userId) {
        validateUser(userId);
        return repository.findActive(userId);
    }

    @Transactional
    public SavedCourseResponse save(Long userId, Long courseId) {
        validateUser(userId);
        if (courseId == null || !repository.existsCourse(courseId)) {
            throw new SavedCourseException(SavedCourseErrorCode.COURSE_NOT_FOUND);
        }
        repository.save(userId, courseId);
        return repository.findActive(userId, courseId)
                .orElseThrow(() -> new SavedCourseException(SavedCourseErrorCode.COURSE_NOT_FOUND));
    }

    /** 담겨 있지 않아도 성공으로 본다(다른 기기에서 이미 뺀 경우). */
    @Transactional
    public void remove(Long userId, Long courseId) {
        validateUser(userId);
        repository.remove(userId, courseId);
    }

    private void validateUser(Long userId) {
        if (userId == null || !repository.existsUser(userId)) {
            throw new SavedCourseException(SavedCourseErrorCode.USER_NOT_FOUND);
        }
    }
}
