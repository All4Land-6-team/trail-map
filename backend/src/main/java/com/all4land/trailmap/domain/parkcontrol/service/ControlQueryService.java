package com.all4land.trailmap.domain.parkcontrol.service;

import com.all4land.trailmap.domain.parkcontrol.dto.response.ControlResponse;
import com.all4land.trailmap.domain.parkcontrol.repository.*;
import com.all4land.trailmap.domain.parkcontrol.storage.ControlImageStorage;
import com.all4land.trailmap.domain.courseroute.exception.CourseRouteException;
import static com.all4land.trailmap.domain.courseroute.error.CourseRouteErrorCode.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

@Service @RequiredArgsConstructor
public class ControlQueryService {
    private final ControlCourseRepository courses;
    private final ParkControlRepository controls;
    private final ControlImageStorage images;
    // 마지막 성공 확인 시각을 주 1회 수집 주기와 비교한다.
    @Value("${park-control.stale-after:P7D}") private Duration staleAfter = Duration.ofDays(7);
    @Transactional(readOnly = true)
    public ControlResponse get(long courseId) {
        if (courseId <= 0) throw new CourseRouteException(INVALID_REQUEST);
        var scope = courses.findScope(courseId).orElseThrow(() -> new CourseRouteException(NOT_FOUND));
        if (scope.mountainKey() == null) {
            return new ControlResponse(courseId, null, "OFFICE_REGION", "UNSUPPORTED", null);
        }
        var row = controls.findByMountainKey(scope.mountainKey()).orElse(null);
        if (row == null || (row.getCheckedAt() == null && !"ERROR".equals(row.getCollectionState()))) {
            return new ControlResponse(courseId, scope.mountainKey(), "OFFICE_REGION", "MISSING", null);
        }
        boolean stale = row.getCheckedAt() == null || row.getCheckedAt().plus(staleAfter).isBefore(Instant.now());
        var assets = new ArrayList<ControlResponse.Asset>();
        boolean signingFailed = false;
        if (!row.getStatus().equals("NORMAL")) for (var asset : row.getAssets()) {
            String url = null;
            try { if (asset.getObjectKey() != null) url = images.readUrl(asset.getObjectKey()); }
            catch (RuntimeException e) { signingFailed = true; }
            assets.add(new ControlResponse.Asset(asset.getKind(), asset.getName(), asset.getSourceUrl(), url));
        }
        boolean normal = row.getStatus().equals("NORMAL");
        var office = new ControlResponse.Office(row.getSourceRecordId(), row.getOfficeName(), row.getStatus(),
                signingFailed && row.getCollectionState().equals("READY") ? "ASSET_ERROR" : row.getCollectionState(), stale,
                row.getSourceAsOf(), row.getCheckedAt(), normal ? null : row.getDetailFetchedAt(), normal ? null : row.getReason(), normal ? null : row.getRestrictedSection(),
                normal ? null : row.getRestrictionPeriodText(), normal ? null : row.getContentText(), normal ? null : row.getContact(), row.getSourceUrl(), assets);
        return new ControlResponse(courseId, scope.mountainKey(), "OFFICE_REGION", "AVAILABLE", office);
    }
}
