package com.all4land.trailmap.domain.savedcourse.exception;

import com.all4land.trailmap.domain.savedcourse.error.SavedCourseErrorCode;
import com.all4land.trailmap.global.exception.BaseException;

public class SavedCourseException extends BaseException {

    public SavedCourseException(SavedCourseErrorCode errorCode) {
        super(errorCode);
    }
}
