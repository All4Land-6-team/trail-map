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
                    SELECT target.user_id AS owner_user_id,
                           target.mountain_id AS parent_id
                    FROM mountain_review target
                    WHERE target.review_id = :targetId AND target.deleted_at IS NULL
                    """;
            case COURSE_REVIEW -> """
                    SELECT target.user_id AS owner_user_id,
                           target.course_id AS parent_id
                    FROM course_review target
                    WHERE target.review_id = :targetId AND target.deleted_at IS NULL
                    """;
            case SPOT_REVIEW -> """
                    SELECT target.user_id AS owner_user_id,
                           COALESCE(target.spot_id, target.facility_id) AS parent_id,
                           CASE WHEN target.spot_id IS NOT NULL THEN 'user-spot' ELSE 'facility' END AS parent_type
                    FROM spot_review target
                    WHERE target.review_id = :targetId AND target.deleted_at IS NULL
                    """;
            case USER_SPOT -> """
                    SELECT target.user_id AS owner_user_id,
                           target.spot_id AS parent_id
                    FROM user_spot target
                    WHERE target.spot_id = :targetId
                      AND target.deleted_at IS NULL
                      AND target.spot_status <> 'HIDDEN'
                    """;
        };
        if (lock) {
            sql += " FOR UPDATE OF target";
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
