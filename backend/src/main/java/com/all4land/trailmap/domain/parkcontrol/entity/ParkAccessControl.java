package com.all4land.trailmap.domain.parkcontrol.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.*;

@Entity @Table(name = "park_access_control")
@Getter @Setter @NoArgsConstructor
public class ParkAccessControl {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long controlId;
    @Version private long version;
    @Column(nullable = false, unique = true, length = 20) private String sourceRecordId;
    @Column(nullable = false, unique = true, length = 30) private String mountainKey;
    @Column(nullable = false, length = 100) private String officeName;
    @Column(nullable = false, length = 4000) private String sourceUrl;
    @Column(nullable = false, length = 20) private String status = "UNKNOWN";
    @Column(columnDefinition = "text") private String reason;
    @Column(columnDefinition = "text") private String contentText;
    @Column(columnDefinition = "text") private String restrictedSection;
    @Column(columnDefinition = "text") private String restrictionPeriodText;
    @Column(columnDefinition = "text") private String contact;
    private Instant sourceAsOf;
    private Instant checkedAt;
    private Instant detailFetchedAt;
    private Instant lastAttemptAt;
    @Column(nullable = false, length = 20) private String collectionState = "MISSING";
    @ElementCollection
    @CollectionTable(name = "park_access_control_asset", joinColumns = @JoinColumn(name = "control_id"))
    @OrderColumn(name = "asset_order")
    private List<ControlAsset> assets = new ArrayList<>();

}
