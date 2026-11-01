package com.all4land.trailmap.domain.courseroute.exception;

import com.all4land.trailmap.domain.courseroute.error.CourseRouteErrorCode;
import com.all4land.trailmap.global.exception.BaseException;

public class CourseRouteException extends BaseException {
    public CourseRouteException(CourseRouteErrorCode code) { super(code); }
}
