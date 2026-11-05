package com.all4land.trailmap.domain.parkcontrol.repository;

import com.all4land.trailmap.domain.parkcontrol.entity.ParkAccessControl;
import org.springframework.data.jpa.repository.*;
import java.util.Optional;

public interface ParkControlRepository extends JpaRepository<ParkAccessControl, Long> {
    @EntityGraph(attributePaths = "assets")
    Optional<ParkAccessControl> findByMountainKey(String mountainKey);
}
