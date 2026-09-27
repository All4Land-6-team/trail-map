package com.all4land.trailmap.global.response;

import com.all4land.trailmap.global.response.code.BaseResponseCode;
import lombok.Getter;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Getter
public class BaseResponse {

    private final Boolean success;
    private final String code;
    private final String message;
    private final String timestamp;

    protected BaseResponse(Boolean success, BaseResponseCode responseCode, String message) {
        this.success = success;
        this.code = responseCode.getCode();
        this.message = message;
        this.timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }
}
