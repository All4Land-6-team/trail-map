package com.all4land.trailmap.domain.courseanalysis.storage;

import com.all4land.trailmap.domain.courseanalysis.service.CourseAnalysisDocumentReader.Stored;

/** 분석 ID에 고정된 문서 저장소. 게시에는 쓰기 트랜잭션이 필요하며 기존 문서를 덮어쓰지 않는다. */
public interface CourseAnalysisStore {
    Stored load(long analysisId);
    void publish(Stored stored);
}
