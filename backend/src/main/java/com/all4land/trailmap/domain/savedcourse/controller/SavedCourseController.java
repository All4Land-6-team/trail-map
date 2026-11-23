package com.all4land.trailmap.domain.savedcourse.controller;

import com.all4land.trailmap.domain.savedcourse.dto.SavedCourseResponse;
import com.all4land.trailmap.domain.savedcourse.service.SavedCourseService;
import com.all4land.trailmap.global.response.SuccessResponse;
import com.all4land.trailmap.global.user.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 등산 담기: 내 담은 코스 목록 · 담기 · 빼기. */
@RestController
@RequestMapping("/v1/saved-courses")
@RequiredArgsConstructor
public class SavedCourseController {

    private final SavedCourseService savedCourseService;

    @GetMapping
    public ResponseEntity<SuccessResponse<List<SavedCourseResponse>>> getSavedCourses(@CurrentUserId Long userId) {
        return response(SuccessResponse.ok(savedCourseService.getSavedCourses(userId)));
    }

    /** 담기. 이미 담겨 있으면 그대로 돌려준다. */
    @PutMapping("/{courseId}")
    public ResponseEntity<SuccessResponse<SavedCourseResponse>> saveCourse(
            @CurrentUserId Long userId,
            @PathVariable Long courseId
    ) {
        return response(SuccessResponse.ok(savedCourseService.save(userId, courseId)));
    }

    /** 빼기. 담겨 있지 않아도 성공. */
    @DeleteMapping("/{courseId}")
    public ResponseEntity<SuccessResponse<Void>> removeCourse(
            @CurrentUserId Long userId,
            @PathVariable Long courseId
    ) {
        savedCourseService.remove(userId, courseId);
        return response(SuccessResponse.ok(null));
    }

    private static <T> ResponseEntity<SuccessResponse<T>> response(SuccessResponse<T> body) {
        return ResponseEntity.status(body.getHttpStatus()).body(body);
    }
}
