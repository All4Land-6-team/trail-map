package com.all4land.trailmap.domain.community.weather;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
@RequiredArgsConstructor
class MountainAsosStationRepository {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    Optional<Integer> findStationId(Long mountainId) {
        return jdbcTemplate.query("""
                SELECT asos_station_id
                FROM mountain
                WHERE mountain_id = :mountainId
                  AND asos_station_id IS NOT NULL
                """, new MapSqlParameterSource("mountainId", mountainId),
                (resultSet, rowNumber) -> resultSet.getInt("asos_station_id")).stream().findFirst();
    }
}
