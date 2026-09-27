package com.all4land.trailmap.global.response;

import com.all4land.trailmap.global.response.code.BaseResponseCode;
import com.all4land.trailmap.global.response.code.SuccessResponseCode;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;

@Getter
@JsonPropertyOrder({"success", "timestamp", "code", "httpStatus", "message", "data"})
public class SuccessResponse<T> extends BaseResponse {

    private final int httpStatus;
    private final T data;

    private SuccessResponse(T data, BaseResponseCode responseCode) {
        super(true, responseCode, responseCode.getMessage());
        this.httpStatus = responseCode.getHttpStatus();
        this.data = data;
    }

    public static <T> SuccessResponse<T> ok(T data) {
        return new SuccessResponse<>(data, SuccessResponseCode.SUCCESS_OK);
    }

    public static <T> SuccessResponse<T> created(T data) {
        return new SuccessResponse<>(data, SuccessResponseCode.SUCCESS_CREATED);
    }
}
