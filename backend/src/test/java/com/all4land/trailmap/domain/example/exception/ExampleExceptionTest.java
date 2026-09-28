package com.all4land.trailmap.domain.example.exception;

import com.all4land.trailmap.domain.example.error.ExampleErrorCode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ExampleExceptionTest {

    @Test
    void 도메인_예외는_전달받은_오류_코드와_메시지를_보존한다() {
        ExampleException exception = new ExampleException(ExampleErrorCode.EXAMPLE_NOT_FOUND);

        assertThat(exception.getResponseCode()).isEqualTo(ExampleErrorCode.EXAMPLE_NOT_FOUND);
        assertThat(exception).hasMessage(ExampleErrorCode.EXAMPLE_NOT_FOUND.getMessage());
    }
}
