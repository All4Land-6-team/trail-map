# 급경사 비율 적용 (#132)

서비스 급경사 기준은 구간 경사 절댓값 20% 이상이며 오르막·내리막을 모두 포함한다.
분자는 급경사 구간의 수평 거리 합, 분모는 고도·경사를 계산할 수 있는 유효 구간의
수평 거리 합이다. 구간 수나 전체 코스 거리로 나누지 않는다. 유효 구간이 없으면
비율은 null, 유효 구간에 급경사가 없으면 0이다. 각도 20도나 공식 난이도 등급이 아니다.

신규 문서는 `schema_version=2`, 기본 알고리즘은 `course-dem-v2-steep-20.0`이다.
임계값을 바꾸면 알고리즘 식별자가 달라지고 기존 분석은 보존된다. 기존 v1 문서는
직렬화와 해시를 유지해 읽으며, SQL 스키마 변경 없이 기존
`course_analysis.steep_section_ratio_percent`와 문서 JSONB에 저장한다.

## 반영 순서

1. #132 코드에서 테스트·빌드 후 아래 로컬 준비 및 문서 검증을 진행한다.
2. PR을 리뷰·병합하고 공용 DB를 쓰는 팀원에게 최신 코드 반영과 백엔드 재시작을 공유한다.
3. 새 문서를 읽을 백엔드가 준비된 후 담당자 한 명이 공용 DB에 적재한다.
4. API와 상세·비교 화면에서 계산 기준과 값을 확인한다.

#132 이전 백엔드는 v2 문서를 지원하지 않는다. 공용 DB의 최신 분석을 바꾸기
전에 코드 배포 순서를 맞춘다. 준비 스크립트와 아래 문서 검증 테스트는 DB에
쓰지 않으므로 PR 전에도 실행할 수 있다. 기존 v1의 급경사 값이 비어 있는 동안
화면의 급경사는 `—`로 표시된다.

## 로컬 결과 준비

백엔드는 #132 코드로 실행해 둔다. PowerShell에서 프로젝트 루트 기준으로 실행한다.
기존 `data/processed/course-analysis` 아래에 현재 공용 분석과 일치하는 JSON이,
`data/processed/dem/bukhansan/analysis/bukhansan_dem.tif`에 같은 분석용 DEM이 필요하다.
이 파일들은 재계산에 쓰며 기존 API 결과를 조회하기 위해 팀원마다 필요하지는 않다.

```powershell
Set-Location C:\trail-map
$steepRun = Join-Path "C:\trail-map\data\processed\course-analysis" `
    ("shared-steep-20-" + (Get-Date -Format "yyyyMMdd-HHmmss"))

& ".\data-pipeline\.venv\Scripts\python.exe" `
    ".\data-pipeline\scripts\prepare-steep-course-analysis.py" `
    --repo-root "C:\trail-map" --output-directory "$steepRun" `
    --steep-slope-threshold-percent 20
if ($LASTEXITCODE -ne 0) { throw "급경사 결과 준비 실패. 적재하지 마세요." }

$steepReport = Get-Content (Join-Path $steepRun "summary.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$steepReport.courses | Select-Object courseId, samples, steepRatioPercent, qualityStatus
```

스크립트는 1~13번 코스의 API·경로·로컬 JSON·DEM SHA-256을 대조하고, 기존
샘플 간격·보간·단위·수직 기준을 보존한다. 새 결과의 프로필, 거리·상승·하강 등
기존 지표와 품질 사유가 같은지 확인하며, 준비 중 API 결과가 바뀌어도 중단한다.
완료한 13건만 `summary.json`에 `readyForImport=true`로 기록한다. 입력 파일은
변경하지 않고 이전 문서와 API 응답도 새 출력 폴더에 보관한다.

백엔드의 실제 문서 검증·저장 직렬화도 확인한다. 이 테스트는 DB에 연결하지 않는다.

```powershell
Set-Location C:\trail-map\backend
$env:STEEP_ANALYSIS_DIRECTORY = $steepRun
try {
    .\gradlew.bat test --tests "*CourseAnalysisSteepRatioTest" --rerun-tasks
    if ($LASTEXITCODE -ne 0) { throw "생성한 13개 분석 문서 검증 실패" }
}
finally {
    Remove-Item Env:STEEP_ANALYSIS_DIRECTORY -ErrorAction SilentlyContinue
}
```

환경 변수로 지정한 실제 파일을 반드시 다시 읽도록 `--rerun-tasks`를 사용한다.
검증 실패 시 기존 분석 파일을 수정해 통과시키지 않고 입력·버전·계산 결과를 확인한다.

## 병합·팀 코드 반영 후 공용 DB 적재

위 준비 작업과 같은 PowerShell 창에서 실행한다. 새 창이라면 `$steepRun`에
검증 완료한 출력 디렉터리를 지정한다. 준비 스크립트를 다시 실행하면 같은
입력으로 새 폴더를 만들 수 있으며, 적재기는 동일한 분석 결과를 중복 삽입하지 않는다.

```powershell
Set-Location C:\trail-map\backend
$steepReport = Get-Content (Join-Path $steepRun "summary.json") -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $steepReport.readyForImport -or @($steepReport.courses).Count -ne 13 -or
    $steepReport.steepSlopeThresholdPercent -ne 20) {
    throw "20% 기준 13개 분석의 준비 완료 결과가 필요합니다."
}
foreach ($course in $steepReport.courses) {
    if ((Get-FileHash -LiteralPath $course.file -Algorithm SHA256).Hash -ne $course.sha256) {
        throw "준비 이후 파일 변경: 코스 $($course.courseId)"
    }
}

.\gradlew.bat bootJar
if ($LASTEXITCODE -ne 0) { throw "백엔드 빌드 실패" }
$steepJar = "C:\trail-map\backend\build\libs\trail-map-backend-0.0.1-SNAPSHOT.jar"
foreach ($course in $steepReport.courses) {
    Write-Host "코스 $($course.courseId) 적재 중..."
    $steepLog = Join-Path $steepRun "import-course-$($course.courseId).log"
    $steepImportArgs = @(
        "--spring.config.additional-location=file:C:/trail-map/backend/src/main/resources/application-secret.properties"
        "--spring.main.web-application-type=none"
        "--course-analysis.storage=database"
        "--course-analysis.import.enabled=true"
        "--course-analysis.import.file=$($course.file)"
        "--course-analysis.import.dem-source-name=북한산 DEM"
        "--course-analysis.import.dem-provider=회사 제공(팀원 전달)"
    )
    & java -jar "$steepJar" @steepImportArgs *> "$steepLog"
    if ($LASTEXITCODE -ne 0) {
        Get-Content -LiteralPath $steepLog -Tail 30
        throw "코스 $($course.courseId) 적재 실패. 이후 코스 적재를 중단합니다."
    }
    Select-String -LiteralPath $steepLog -Pattern "Course analysis import complete"
}
```

각 코스는 별도 트랜잭션으로 적재한다. 중간 실패 시 성공한 코스의 새 기록은 남고,
기존 기록도 보존된다. 원인을 해결한 뒤 같은 파일로 재실행할 수 있다. 기존과 다른
내용을 같은 식별자로 강제 덮어쓰거나 DB 문서·해시를 직접 수정하지 않는다.

## 조회 및 화면 확인

```powershell
$steepApi = "http://localhost:8080"
$steepRows = foreach ($id in 1..13) {
    $a = (Invoke-RestMethod "$steepApi/api/v1/courses/$id/analysis" -ErrorAction Stop).data
    $p = (Invoke-RestMethod ($steepApi + $a.profileUrl) -ErrorAction Stop).data
    if ($a.settings.steepSlopeThresholdPercent -ne 20 -or
        $a.settings.steepSlopeMethod -ne "absolute_slope_gte_distance_weighted" -or
        $a.settings.elevationUnitSource -ne "caller_declaration" -or
        $null -eq $a.metrics.steepSectionRatioPercent -or
        $a.metrics.steepSectionRatioPercent -lt 0 -or $a.metrics.steepSectionRatioPercent -gt 100 -or
        $p.analysis.analysisId -ne $a.analysisId -or
        $p.analysis.metrics.steepSectionRatioPercent -ne $a.metrics.steepSectionRatioPercent) {
        throw "코스 $id 조회 결과를 확인해 주세요."
    }
    [PSCustomObject]@{
        courseId = $id
        analysisId = $a.analysisId
        steepRatio = "{0:N1}%" -f $a.metrics.steepSectionRatioPercent
        samples = @($p.samples).Count
        qualityStatus = $a.qualityStatus
    }
}
$steepRows | Format-Table -AutoSize
```

실제 13개 코스는 준비 시 유효 구간을 확보한 결과이므로 위 확인은 비율이 null이면
중단한다. 일반 API는 유효 구간이 없는 다른 분석의 null을 정상 결측으로 유지한다.
수직 기준 미확인에 따른 `PARTIAL`도 유지한다. 화면을 새로고침해 상세의 급경사 값·기준,
비교표의 급경사 비율과 소수 1자리 표시, 그래프·지도 마커 연동을 확인한다.

예상 시간 정책·일정 등록·연속 오르막·코스 목록 필터의 분석 연결은 이 작업에 포함하지 않는다.
실제 DEM·경로·산출물·로그와 비밀 설정은 Git에 커밋하지 않는다.
