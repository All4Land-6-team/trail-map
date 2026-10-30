# Windows PowerShell 5.1 / PowerShell 7. Uses only the existing local development DB.
[CmdletBinding()]
param(
    [int[]]$CourseIds = @(2, 3),
    [string]$ContainerName = 'trail-map-postgis',
    [string]$ProducerRef = 'origin/feature/80-course-analysis',
    [string]$DemPath = '',
    [string]$OutputDirectory = '',
    [string]$DemSourceName = '북한산 DEM',
    [string]$DemProvider = '회사 제공(팀원 전달)'
)

$ErrorActionPreference = 'Stop'
$pipelinePath = Split-Path -Parent $PSScriptRoot
$repoPath = Split-Path -Parent $pipelinePath
$backendPath = Join-Path $repoPath 'backend'
$pythonPath = Join-Path $pipelinePath '.venv\Scripts\python.exe'
if (-not $DemPath) { $DemPath = Join-Path $repoPath 'data\processed\dem\bukhansan\analysis\bukhansan_dem.tif' }
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $repoPath 'data\processed\course-analysis' }
if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf)) { throw "Python venv not found: $pythonPath" }
if (-not (Test-Path -LiteralPath $DemPath -PathType Leaf)) { throw "Analysis DEM not found: $DemPath" }
if ($CourseIds.Count -lt 1 -or $CourseIds.Count -gt 3 -or @($CourseIds | Select-Object -Unique).Count -ne $CourseIds.Count -or
    @($CourseIds | Where-Object { $_ -lt 1 -or $_ -gt 7 }).Count -gt 0) {
    throw 'Use 1-3 distinct development Bukhansan course IDs between 1 and 7.'
}

$interimPath = Join-Path $repoPath 'data\interim\courses'
New-Item -ItemType Directory -Path $interimPath, $OutputDirectory -Force | Out-Null
$previousPythonPath = $env:PYTHONPATH
$analysisWorktree = $null
Push-Location $repoPath
try {
    docker start $ContainerName
    if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop and check the existing PostGIS container.' }
    $dbReady = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        docker exec $ContainerName pg_isready -U postgres -d trail_map *> $null
        if ($LASTEXITCODE -eq 0) { $dbReady = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $dbReady) { throw 'PostGIS is not ready yet. Check the container logs and retry.' }

    $producerPath = $repoPath
    if (-not (Test-Path -LiteralPath (Join-Path $pipelinePath 'src\trail_map_data\course_analysis.py'))) {
        # PR #83 may still be unmerged. Read its code without merging or changing the current branch.
        git cat-file -e "${ProducerRef}:data-pipeline/src/trail_map_data/course_analysis.py"
        if ($LASTEXITCODE -ne 0) { throw 'Run git fetch origin, then check the analysis producer ref.' }
        $analysisWorktree = Join-Path ([System.IO.Path]::GetTempPath()) ('trail-map-analysis-' + [guid]::NewGuid().ToString('N'))
        # Avoid Git's commit-subject output, which can fail in Windows consoles after checkout.
        git worktree add --quiet --detach $analysisWorktree $ProducerRef
        if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the analysis producer worktree.' }
        $producerPath = $analysisWorktree
    }
    $env:PYTHONPATH = Join-Path $producerPath 'data-pipeline\src'

    foreach ($courseId in $CourseIds) {
        $geojsonPath = Join-Path $interimPath "course-$courseId.geojson"
        $outputPath = Join-Path $OutputDirectory "course-$courseId-dev-assumed-m.json"
        $seedNumber = $courseId.ToString('00')
        # Refuse real or unrelated rows that happen to use the same IDs. No INSERT/UPDATE/DELETE.
        $sql = "SELECT json_build_object('type','Feature','properties',json_build_object('course_id',course_id,'mountain_id',mountain_id,'course_version',course_version,'course_name',course_name,'source_id',source_id,'source_kind','development'),'geometry',ST_AsGeoJSON(course_geometry)::json) FROM course WHERE course_id=$courseId AND mountain_id=1 AND source_hash=encode(sha256(convert_to('dev-seed-course-$seedNumber','UTF8')),'hex');"
        docker exec $ContainerName psql -U postgres -d trail_map -At -v ON_ERROR_STOP=1 -o "/tmp/course-$courseId.geojson" -c $sql
        if ($LASTEXITCODE -ne 0) { throw "Could not export course $courseId." }
        docker cp "${ContainerName}:/tmp/course-$courseId.geojson" $geojsonPath
        if ($LASTEXITCODE -ne 0) { throw "Could not copy course $courseId." }
        $feature = Get-Content -LiteralPath $geojsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if (-not $feature -or $feature.geometry.type -ne 'LineString') {
            throw "Course $courseId is missing or is not the expected development seed. No seed data was inserted."
        }
        if (-not (Test-Path -LiteralPath $outputPath)) {
            & $pythonPath -m trail_map_data.cli course analyze $DemPath $geojsonPath --sample-interval-meters 10 --elevation-unit m --output $outputPath
            if ($LASTEXITCODE -ne 0) { throw "Analysis failed for course $courseId." }
        } else {
            Write-Host "Reusing existing JSON (no overwrite): $outputPath"
        }
        $document = Get-Content -LiteralPath $outputPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($document.course.course_id -ne $courseId -or $document.course.mountain_id -ne 1 -or
            $document.course.course_version -ne $feature.properties.course_version -or $document.course.source_kind -ne 'development' -or
            $document.settings.elevation_unit -ne 'm' -or $document.settings.sample_interval_meters -ne 10) {
            throw "Existing JSON does not match course $courseId. Choose a new OutputDirectory for a new analysis."
        }
        Write-Host "Course $courseId - $($document.quality_status), samples=$($document.summary.sample_count), coverage=$($document.summary.sample_coverage_percent)%"
    }

    Push-Location $backendPath
    try {
        & .\gradlew.bat bootJar
        if ($LASTEXITCODE -ne 0) { throw 'Backend bootJar failed.' }
        foreach ($courseId in $CourseIds) {
            $outputPath = Join-Path $OutputDirectory "course-$courseId-dev-assumed-m.json"
            & java -jar '.\build\libs\trail-map-backend-0.0.1-SNAPSHOT.jar' '--spring.main.web-application-type=none' `
                '--course-analysis.import.enabled=true' "--course-analysis.import.file=$outputPath" `
                "--course-analysis.import.dem-source-name=$DemSourceName" "--course-analysis.import.dem-provider=$DemProvider"
            if ($LASTEXITCODE -ne 0) { throw "Import failed for course $courseId. The existing analysis was not overwritten." }
        }
    } finally { Pop-Location }
    Write-Host 'Development analysis preparation finished. Check course-comparisons from the running backend.'
} finally {
    $env:PYTHONPATH = $previousPythonPath
    if ($analysisWorktree -and (Test-Path -LiteralPath $analysisWorktree)) {
        git worktree remove $analysisWorktree
        if ($LASTEXITCODE -ne 0) { Write-Warning "Temporary worktree kept at $analysisWorktree. Remove it after checking its contents." }
    }
    Pop-Location
}
