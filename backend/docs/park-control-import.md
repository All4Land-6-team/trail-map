# 북한산 통제정보 수집 (#130)

아래 수동 명령은 백엔드 디렉터리에서 실행한다. 대상 DB에는 Flyway V11의 사무소 행 두 개가 필요하다. 수동 명령은 기본적으로 미적용 migration을 먼저 적용하므로 공용 DB에서 처음 실행할 때는 Flyway 이력을 확인한다. 일반 서버 실행과 수집은 분리되어 있다. 배포 서버에서는 주 1회 자동 실행하고 필요 시 수동 실행한다. 마지막 성공 확인 후 7일이 지나면 화면은 오래된 정보임을 표시한다.

```powershell
.\gradlew.bat bootRun --args='--spring.main.web-application-type=none --park-control.import.enabled=true'
```

목록의 북한산(0019)·북한산도봉(0020)을 확인하고 정상 사무소의 상세 요청은 생략한다. 부분·전면 통제는 목록과 상세의 사무소, 상태, 기준시간(분)을 대조한다. 구간·기간·문의처가 별도 항목으로 식별되지 않을 때도 본문을 보존한다. 사무소별로 현재 행과 첨부 목록을 한 트랜잭션에서 교체한다. 목록 조회 실패 시 이전 자료와 마지막 성공 시각을 유지하고 ERROR를 기록한다.

기본 설정은 본문·첨부 이미지를 검증한 뒤 프로젝트 루트의 `data/raw/knps/control/park-control/{rstId}/{sha256}.{형식}`에 저장한다. DB에 원본 URL과 실제 MIME 형식을 남기고 R2 객체 키는 비운다. 이 경우 화면은 이미지 대신 공단 첨부 링크를 표시한다. 본문은 줄별 앞뒤 공백을 지우고 연속 빈 줄을 한 줄로 줄여 저장한다. R2가 설정된 환경에서는 실행 인자에 `--park-control.import.upload=true`를 추가해 원본 바이트를 R2에 저장할 수 있다. 이미지 실패 시 본문과 원본 링크가 남고 실행 결과는 실패다. 다음 실행에서 재수집한다.

## 배포 서버에서 주 1회 자동 실행

Linux 서버 한 대에서 [service](../deploy/systemd/trail-map-park-control.service)와 [timer](../deploy/systemd/trail-map-park-control.timer)를 사용한다. 매주 월요일 04:00(Asia/Seoul)에 실행하며 서버가 꺼져서 지난 예약은 다음 시작 시 한 번 수행한다. 마지막 성공 확인 시각으로부터 7일이 지나면 오래된 정보로 표시한다.

1. V11 적용과 수동 수집을 먼저 확인한다. 운영자는 Java 21과 서비스 계정 `trail-map`을 준비하고 배포한 실행 JAR을 `/opt/trail-map/trail-map-backend.jar`에 둔다. 예약 작업은 Flyway를 실행하지 않는다.
2. 운영 서버의 `/etc/trail-map/park-control.env`에 `DB_URL`(JDBC URL), `DB_USERNAME`, `DB_PASSWORD`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`를 systemd 환경 파일 형식으로 지정한다. 파일은 root 소유, 권한 0600으로 관리한다. 애플리케이션 설정 파일 대신 이 파일로 실행 환경을 제공한다.
3. 배포 시 두 unit 파일을 `/etc/systemd/system/`에 설치하고 `systemctl daemon-reload`, `systemctl enable --now trail-map-park-control.timer`를 실행한다. `systemctl list-timers trail-map-park-control.timer`에서 다음 실행을 확인한다. 즉시 실행할 때는 같은 service를 `systemctl start trail-map-park-control.service`로 호출해 자동 실행과 중복되지 않게 한다.
4. 한 번의 실행은 15분으로 제한하며 실패하면 5분 뒤 한 번 재시도한다. `journalctl -u trail-map-park-control.service`에서 사무소별 결과와 실패 사유를 조회한다. 배포 환경의 운영 모니터에는 해당 unit의 failed 상태를 연결한다. 원인을 해결한 후 `systemctl reset-failed trail-map-park-control.service`, `systemctl start trail-map-park-control.service`로 재실행한다.

## 격리된 적재 검증

```powershell
$env:KNPS_LIVE_TEST='true'
.\gradlew.bat test --tests '*ControlCollectorTest' --rerun-tasks
Remove-Item Env:KNPS_LIVE_TEST
```

실제 사이트 검증은 V11 SQL로 초기화한 메모리 H2 DB와 임시 이미지 폴더를 사용한다. 두 차례 수집 후 상태·자산 건수를 확인한다. 환경변수가 없으면 고정 HTML로 재수집, 누락 오류, 정상 전환을 시험한다.
