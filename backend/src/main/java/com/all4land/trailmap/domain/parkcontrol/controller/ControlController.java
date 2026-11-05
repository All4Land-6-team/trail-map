package com.all4land.trailmap.domain.parkcontrol.controller;

import com.all4land.trailmap.domain.parkcontrol.service.ControlQueryService;
import com.all4land.trailmap.domain.parkcontrol.dto.response.ControlResponse;
import com.all4land.trailmap.global.response.SuccessResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;

@RestController @RequiredArgsConstructor
@RequestMapping("/v1/courses")
public class ControlController {
    private final ControlQueryService service;
    @GetMapping("/{courseId}/access-control")
    public ResponseEntity<SuccessResponse<ControlResponse>> get(@PathVariable long courseId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(SuccessResponse.ok(service.get(courseId)));
    }
}
