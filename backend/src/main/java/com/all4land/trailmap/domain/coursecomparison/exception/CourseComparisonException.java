package com.all4land.trailmap.domain.coursecomparison.exception;

import com.all4land.trailmap.domain.coursecomparison.error.CourseComparisonErrorCode;
import com.all4land.trailmap.global.exception.BaseException;

public class CourseComparisonException extends BaseException {
    public CourseComparisonException(CourseComparisonErrorCode code) {
        super(code);
    }
}
