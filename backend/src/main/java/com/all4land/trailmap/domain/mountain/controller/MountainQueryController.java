package com.all4land.trailmap.domain.mountain.controller;

import com.all4land.trailmap.domain.mountain.dto.response.MountainResponse;
import com.all4land.trailmap.domain.mountain.service.MountainQueryService;
import com.all4land.trailmap.global.response.SuccessResponse;
import com.all4land.trailmap.global.user.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/v1/mountains")
@RequiredArgsConstructor
public class MountainQueryController {

    private final MountainQueryService service;

    @GetMapping
    public SuccessResponse<List<MountainResponse>> getMountains(@CurrentUserId Long userId) {
        return SuccessResponse.ok(service.getMountains());
    }
}
