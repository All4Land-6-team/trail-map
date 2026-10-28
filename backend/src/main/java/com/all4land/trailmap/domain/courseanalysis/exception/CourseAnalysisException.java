package com.all4land.trailmap.domain.courseanalysis.exception;

import com.all4land.trailmap.domain.courseanalysis.error.CourseAnalysisErrorCode;
import com.all4land.trailmap.global.exception.BaseException;

public class CourseAnalysisException extends BaseException {
    public CourseAnalysisException(CourseAnalysisErrorCode code) {
        super(code);
    }
}
