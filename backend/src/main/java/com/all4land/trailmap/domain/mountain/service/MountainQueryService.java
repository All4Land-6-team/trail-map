package com.all4land.trailmap.domain.mountain.service;

import com.all4land.trailmap.domain.mountain.dto.response.MountainResponse;
import com.all4land.trailmap.domain.mountain.repository.MountainQueryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MountainQueryService {

    private final MountainQueryRepository repository;

    public List<MountainResponse> getMountains() {
        return repository.findAll();
    }
}
