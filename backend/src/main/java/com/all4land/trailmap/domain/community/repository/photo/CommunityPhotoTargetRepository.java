package com.all4land.trailmap.domain.community.repository.photo;

import com.all4land.trailmap.domain.community.entity.CommunityPhotoTargetType;
import com.all4land.trailmap.domain.community.repository.result.CommunityPhotoTargetQueryResult;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class CommunityPhotoTargetRepository {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public Optional<CommunityPhotoTargetQueryResult> findTarget(
            CommunityPhotoTargetType targetType,
            Long targetId
    ) {
        return findTarget(targetType, targetId, false);
    }

    public Optional<CommunityPhotoTargetQueryResult> lockTarget(
            CommunityPhotoTargetType targetType,
            Long targetId
    ) {
        return findTarget(targetType, targetId, true);
    }

    private Optional<CommunityPhotoTargetQueryResult> findTarget(
            CommunityPhotoTargetType targetType,
            Long targetId,
            boolean lock
    ) {
        String sql = switch (targetType) {
            case MOUNTAIN_REVIEW -> """
                    SELECT user_id AS owner_user_id, mountain_id AS parent_id
                    FROM mountain_review
                    WHERE review_id = :targetId AND deleted_at IS NULL
                    """;
            case COURSE_REVIEW -> """
                    SELECT user_id AS owner_user_id, course_id AS parent_id
                    FROM course_review
                    WHERE review_id = :targetId AND deleted_at IS NULL
                    """;
            case SPOT_REVIEW -> """
                    SELECT user_id AS owner_user_id,
                           COALESCE(spot_id, facility_id) AS parent_id,
                           CASE WHEN spot_id IS NOT NULL THEN 'user-spot' ELSE 'facility' END AS parent_type
                    FROM spot_review
                    WHERE review_id = :targetId AND deleted_at IS NULL
                    """;
            case USER_SPOT -> """
                    SELECT user_id AS owner_user_id, spot_id AS parent_id
                    FROM user_spot
                    WHERE spot_id = :targetId
                      AND deleted_at IS NULL
                      AND spot_status <> 'HIDDEN'
                    """;
        };
        if (lock) {
            sql += " FOR UPDATE";
        }
        return jdbcTemplate.query(
                sql,
                new MapSqlParameterSource("targetId", targetId),
                (resultSet, rowNumber) -> new CommunityPhotoTargetQueryResult(
                        targetType,
                        targetId,
                        resultSet.getLong("owner_user_id"),
                        targetType == CommunityPhotoTargetType.SPOT_REVIEW
                                ? resultSet.getString("parent_type")
                                : parentType(targetType),
                        resultSet.getLong("parent_id")
                )
        ).stream().findFirst();
    }

    private static String parentType(CommunityPhotoTargetType targetType) {
        return switch (targetType) {
            case MOUNTAIN_REVIEW -> "mountain";
            case COURSE_REVIEW -> "course";
            case SPOT_REVIEW -> throw new IllegalArgumentException("스팟 후기 유형은 조회 결과에서 결정합니다.");
            case USER_SPOT -> "user-spot";
        };
    }
}
