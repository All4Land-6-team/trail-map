package com.all4land.trailmap.domain.community.repository;

import com.all4land.trailmap.domain.community.entity.CommunitySpotTargetType;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class CommunityPhotoQueryRepository {

    private static final String PHOTO_SELECT = """
            SELECT photo.photo_id,
                   photo.object_key,
                   photo.original_file_name,
                   photo.media_type,
                   photo.file_size_bytes,
                   photo.display_order,
                   COALESCE(NULLIF(btrim(app_user.nickname), ''), '익명' || app_user.user_id) AS author,
                   COALESCE(mountain_review.review_content,
                            course_review.review_content,
                            spot_review.review_content) AS review_content,
                   photo.created_at
            FROM photo
            JOIN app_user ON app_user.user_id = photo.user_id
            LEFT JOIN mountain_review ON mountain_review.review_id = photo.mountain_review_id
            LEFT JOIN course_review ON course_review.review_id = photo.course_review_id
            LEFT JOIN spot_review ON spot_review.review_id = photo.spot_review_id
            """;

    private static final RowMapper<CommunityPhotoQueryResult> ROW_MAPPER = (resultSet, rowNumber) ->
            new CommunityPhotoQueryResult(
                    resultSet.getLong("photo_id"),
                    resultSet.getString("object_key"),
                    resultSet.getString("original_file_name"),
                    resultSet.getString("media_type"),
                    resultSet.getLong("file_size_bytes"),
                    resultSet.getInt("display_order"),
                    resultSet.getString("author"),
                    resultSet.getString("review_content"),
                    resultSet.getObject("created_at", java.time.OffsetDateTime.class)
            );

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public List<CommunityPhotoQueryResult> findMountainPhotos(Long mountainId) {
        return findAll("""
                photo.deleted_at IS NULL
                AND mountain_review.mountain_id = :targetId
                AND mountain_review.deleted_at IS NULL
                """, mountainId);
    }

    public List<CommunityPhotoQueryResult> findCoursePhotos(Long courseId) {
        return findAll("""
                photo.deleted_at IS NULL
                AND course_review.course_id = :targetId
                AND course_review.deleted_at IS NULL
                """, courseId);
    }

    public List<CommunityPhotoQueryResult> findSpotPhotos(
            CommunitySpotTargetType targetType,
            Long targetId
    ) {
        String targetCondition = switch (targetType) {
            case FACILITY -> """
                    photo.facility_id = :targetId
                    OR spot_review.facility_id = :targetId
                    """;
            case USER_SPOT -> """
                    photo.spot_id = :targetId
                    OR spot_review.spot_id = :targetId
                    """;
        };
        return findAll("photo.deleted_at IS NULL AND (" + targetCondition + ")", targetId);
    }

    public Optional<CommunityPhotoQueryResult> findPhoto(Long photoId) {
        String sql = PHOTO_SELECT + """
                WHERE photo.photo_id = :targetId
                  AND photo.deleted_at IS NULL
                """;
        return jdbcTemplate.query(
                sql,
                new MapSqlParameterSource("targetId", photoId),
                ROW_MAPPER
        ).stream().findFirst();
    }

    private List<CommunityPhotoQueryResult> findAll(String condition, Long targetId) {
        String sql = PHOTO_SELECT + " WHERE " + condition + """
                ORDER BY photo.created_at DESC, photo.display_order, photo.photo_id DESC
                """;
        return jdbcTemplate.query(sql, new MapSqlParameterSource("targetId", targetId), ROW_MAPPER);
    }
}
