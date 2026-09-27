package com.all4land.trailmap.global.response;

import com.all4land.trailmap.global.response.code.BaseResponseCode;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;

@Getter
@JsonPropertyOrder({"success", "timestamp", "code", "httpStatus", "message", "data"})
public class ErrorResponse<T> extends BaseResponse {

    private final int httpStatus;
    private final T data;

    private ErrorResponse(T data, BaseResponseCode responseCode, String message) {
        super(false, responseCode, message);
        this.httpStatus = responseCode.getHttpStatus();
        this.data = data;
    }

    public static ErrorResponse<Void> from(BaseResponseCode responseCode) {
        return new ErrorResponse<>(null, responseCode, responseCode.getMessage());
    }

    public static ErrorResponse<Void> of(BaseResponseCode responseCode, String message) {
        return new ErrorResponse<>(null, responseCode, message);
    }
}
