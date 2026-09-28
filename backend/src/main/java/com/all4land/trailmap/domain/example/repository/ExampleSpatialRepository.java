package com.all4land.trailmap.domain.example.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class ExampleSpatialRepository {

    private final JdbcTemplate jdbcTemplate;
}
