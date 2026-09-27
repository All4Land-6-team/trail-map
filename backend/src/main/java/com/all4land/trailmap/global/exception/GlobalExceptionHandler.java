package com.all4land.trailmap.global.exception;

import com.all4land.trailmap.global.response.ErrorResponse;
import com.all4land.trailmap.global.response.code.ErrorResponseCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler({MethodArgumentNotValidException.class, BindException.class})
    public ResponseEntity<ErrorResponse<Void>> handleValidationException(Exception exception) {
        log.warn("Validation failed", exception);
        return response(ErrorResponse.of(ErrorResponseCode.INVALID_HTTP_MESSAGE_BODY, "요청 값이 올바르지 않습니다."));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ErrorResponse<Void>> handleRequestFormatException(Exception exception) {
        log.warn("Invalid request format", exception);
        return response(ErrorResponse.from(ErrorResponseCode.INVALID_HTTP_MESSAGE_PARAMETER));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse<Void>> handleMethodNotSupportedException(HttpRequestMethodNotSupportedException exception) {
        return response(ErrorResponse.from(ErrorResponseCode.UNSUPPORTED_HTTP_METHOD));
    }

    @ExceptionHandler(BaseException.class)
    public ResponseEntity<ErrorResponse<Void>> handleBaseException(BaseException exception) {
        return response(ErrorResponse.from(exception.getResponseCode()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse<Void>> handleUnexpectedException(Exception exception) {
        log.error("Unexpected server error", exception);
        return response(ErrorResponse.from(ErrorResponseCode.SERVER_ERROR));
    }

    private ResponseEntity<ErrorResponse<Void>> response(ErrorResponse<Void> errorResponse) {
        return ResponseEntity.status(errorResponse.getHttpStatus()).body(errorResponse);
    }
}
