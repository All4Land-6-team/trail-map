package com.all4land.trailmap.domain.mountain.repository;

import com.all4land.trailmap.domain.mountain.dto.response.MountainResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@RequiredArgsConstructor
public class MountainQueryRepository {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public List<MountainResponse> findAll() {
        return jdbcTemplate.query("""
                SELECT mountain_id,
                       source_record_id AS external_id,
                       mountain_name,
                       ST_X(mountain_display_location) AS longitude,
                       ST_Y(mountain_display_location) AS latitude
                FROM mountain
                ORDER BY mountain_name, mountain_id
                """, (resultSet, rowNumber) -> new MountainResponse(
                resultSet.getLong("mountain_id"),
                resultSet.getString("external_id"),
                resultSet.getString("mountain_name"),
                resultSet.getDouble("longitude"),
                resultSet.getDouble("latitude")
        ));
    }
}
