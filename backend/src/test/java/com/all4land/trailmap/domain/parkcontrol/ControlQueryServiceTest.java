package com.all4land.trailmap.domain.parkcontrol;

import com.all4land.trailmap.domain.parkcontrol.entity.*;
import com.all4land.trailmap.domain.parkcontrol.repository.*;
import com.all4land.trailmap.domain.parkcontrol.service.ControlQueryService;
import com.all4land.trailmap.domain.parkcontrol.storage.ControlImageStorage;
import com.all4land.trailmap.domain.courseroute.exception.CourseRouteException;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.Optional;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class ControlQueryServiceTest {
    final ControlCourseRepository courses = mock(ControlCourseRepository.class);
    final ParkControlRepository controls = mock(ParkControlRepository.class);
    final ControlImageStorage images = mock(ControlImageStorage.class);
    final ControlQueryService service = new ControlQueryService(courses, controls, images);
    ParkAccessControl row(String id, String status) {
        var r = new ParkAccessControl(); r.setSourceRecordId(id); r.setStatus(status); r.setOfficeName(id);
        r.setCheckedAt(Instant.now()); r.setSourceAsOf(Instant.parse("2026-10-18T14:06:00Z")); r.setCollectionState("READY");
        r.setReason("산사태 발생"); r.setContentText("안내");
        r.getAssets().add(new ControlAsset("INLINE", "지도", "https://www.knps.or.kr/image", "key", "image/png"));
        when(controls.findByMountainKey(id.equals("0019") ? "bukhansan" : "dobongsan")).thenReturn(Optional.of(r)); return r;
    }
    @Test void selectsOfficeFromCourseAndKeepsNormalSeparate() {
        when(courses.findScope(1)).thenReturn(Optional.of(new ControlCourseRepository.Scope(1, "bukhansan")));
        when(courses.findScope(2)).thenReturn(Optional.of(new ControlCourseRepository.Scope(2, "dobongsan")));
        row("0019", "PARTIAL"); row("0020", "NORMAL"); when(images.readUrl("key")).thenReturn("https://example.com/read");
        var partial=service.get(1); var normal=service.get(2);
        assertThat(partial.office().sourceRecordId()).isEqualTo("0019");
        assertThat(partial.office().reason()).isEqualTo("산사태 발생");
        assertThat(partial.office().assets().getFirst().imageUrl()).isEqualTo("https://example.com/read");
        assertThat(normal.office().sourceRecordId()).isEqualTo("0020");
        assertThat(normal.office().contentText()).isNull(); assertThat(normal.office().reason()).isNull();
        assertThat(normal.office().assets()).isEmpty(); verify(images, times(1)).readUrl("key");
    }
    @Test void missingStaleFailedAndUnsupportedAreNotNormal() {
        when(courses.findScope(1)).thenReturn(Optional.of(new ControlCourseRepository.Scope(1, "bukhansan")));
        when(controls.findByMountainKey("bukhansan")).thenReturn(Optional.empty());
        assertThat(service.get(1).availability()).isEqualTo("MISSING");
        var r=row("0019", "PARTIAL"); r.setCheckedAt(Instant.now().minusSeconds(8 * 86400)); r.setCollectionState("ERROR");
        assertThat(service.get(1).office().stale()).isTrue(); assertThat(service.get(1).office().collectionState()).isEqualTo("ERROR");
        when(courses.findScope(3)).thenReturn(Optional.of(new ControlCourseRepository.Scope(3, null)));
        assertThat(service.get(3).availability()).isEqualTo("UNSUPPORTED");
        when(courses.findScope(4)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.get(4)).isInstanceOf(CourseRouteException.class);
    }
    @Test void signingFailurePreservesText() {
        when(courses.findScope(1)).thenReturn(Optional.of(new ControlCourseRepository.Scope(1, "bukhansan")));
        row("0019", "PARTIAL"); when(images.readUrl("key")).thenThrow(new IllegalStateException());
        var response=service.get(1); assertThat(response.office().collectionState()).isEqualTo("ASSET_ERROR");
        assertThat(response.office().contentText()).isEqualTo("안내");
        assertThat(response.office().assets().getFirst().imageUrl()).isNull();
    }
}
