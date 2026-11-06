package com.all4land.trailmap.domain.parkcontrol.entity;

import jakarta.persistence.*;
import lombok.*;

@Embeddable
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ControlAsset {
    @Column(nullable = false, length = 20) private String kind;
    @Column(nullable = false, length = 500) private String name;
    @Column(nullable = false, length = 4000) private String sourceUrl;
    @Column(length = 500) private String objectKey;
    @Column(length = 50) private String mediaType;
}
