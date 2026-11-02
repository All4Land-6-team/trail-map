package com.all4land.trailmap.domain.auth.controller;

import com.all4land.trailmap.domain.auth.dto.request.LoginRequest;
import com.all4land.trailmap.domain.auth.dto.request.SignupRequest;
import com.all4land.trailmap.domain.auth.dto.response.AuthSessionResponse;
import com.all4land.trailmap.domain.auth.dto.response.AuthUserResponse;
import com.all4land.trailmap.domain.auth.service.AuthService;
import com.all4land.trailmap.global.response.SuccessResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/signup")
    public ResponseEntity<SuccessResponse<AuthSessionResponse>> signup(@Valid @RequestBody SignupRequest request) {
        return response(SuccessResponse.created(authService.signup(request)));
    }

    @PostMapping("/login")
    public ResponseEntity<SuccessResponse<AuthSessionResponse>> login(@Valid @RequestBody LoginRequest request) {
        return response(SuccessResponse.ok(authService.login(request)));
    }

    @GetMapping("/me")
    public ResponseEntity<SuccessResponse<AuthUserResponse>> me(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) {
        return response(SuccessResponse.ok(authService.me(authorization)));
    }

    @PostMapping("/logout")
    public ResponseEntity<SuccessResponse<Void>> logout(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) {
        authService.logout(authorization);
        return response(SuccessResponse.ok(null));
    }

    private static <T> ResponseEntity<SuccessResponse<T>> response(SuccessResponse<T> body) {
        return ResponseEntity.status(body.getHttpStatus()).body(body);
    }
}
