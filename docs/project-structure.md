# 프로젝트 폴더 구조

```text
trail-map/
├─ frontend/                 # React + Vite + TypeScript
├─ backend/                  # Java 21 + Spring Boot
├─ docs/                     # 프로젝트 문서
├─ data/                     # 로컬 원본·가공 데이터, Git 제외
└─ AGENTS.md                 # 공통 AI 작업·Git 규칙
```

## Frontend

```text
frontend/
├─ public/
├─ src/
│  ├─ api/
│  ├─ assets/
│  │  ├─ css/
│  │  ├─ fonts/
│  │  └─ images/
│  ├─ components/
│  │  ├─ common/
│  │  ├─ layout/
│  │  └─ map/
│  ├─ constants/
│  ├─ hooks/
│  ├─ pages/
│  ├─ routes/
│  ├─ store/
│  ├─ types/
│  ├─ utils/
│  ├─ App.tsx
│  └─ main.tsx
├─ .env.example
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

| 폴더/파일 | 역할 |
|---|---|
| `public` | favicon, PWA manifest처럼 빌드 과정 없이 제공하는 정적 파일 |
| `src/api` | Axios 설정과 백엔드 API 요청 코드 |
| `src/assets/css` | 전역 CSS, reset, 공통 스타일 |
| `src/assets/fonts` | 프로젝트에서 사용하는 폰트 파일 |
| `src/assets/images` | 프로젝트 이미지와 아이콘 |
| `src/components/common` | 버튼, 입력창, 모달처럼 여러 화면에서 재사용하는 UI |
| `src/components/layout` | 헤더, 사이드바, 바텀시트 등 화면 골격 UI |
| `src/components/map` | MapLibre 공용 컴포넌트와 지도 관련 공용 코드 |
| `src/constants` | API 주소, 지도 기본 좌표·줌 등 고정값 |
| `src/hooks` | `useGeolocation` 같은 재사용 Custom Hook |
| `src/pages` | 페이지 화면. 페이지에서만 사용하는 UI는 `pages/<PageName>/components`에 둠 |
| `src/routes` | React Router 설정 |
| `src/store` | 전역 상태 관리 도구를 도입할 때 사용하는 코드 |
| `src/types` | 프로젝트 공용 TypeScript 타입 |
| `src/utils` | 날짜·거리·좌표 계산처럼 순수한 공용 함수 |
| `App.tsx` | 애플리케이션 최상위 컴포넌트 |
| `main.tsx` | React 앱을 브라우저 DOM에 연결하는 진입점 |

## Backend

```text
backend/
├─ docs/
│  └─ migration.md            # Flyway·PostGIS·DB 변경 규칙
├─ src/
│  ├─ main/
│  │  ├─ java/com/all4land/trailmap/
│  │  │  ├─ global/
│  │  │  │  ├─ config/
│  │  │  │  ├─ constant/
│  │  │  │  ├─ entity/
│  │  │  │  ├─ exception/
│  │  │  │  └─ response/
│  │  │  │     └─ code/
│  │  │  ├─ domain/
│  │  │  │  └─ example/
│  │  │  │     ├─ entity/
│  │  │  │     ├─ repository/
│  │  │  │     ├─ service/
│  │  │  │     ├─ controller/
│  │  │  │     ├─ dto/
│  │  │  │     │  ├─ request/
│  │  │  │     │  └─ response/
│  │  │  │     ├─ error/
│  │  │  │     └─ exception/
│  │  │  └─ TrailMapApplication.java
│  │  └─ resources/
│  │     ├─ application.properties
│  │     ├─ application-secret.properties
│  │     └─ db/migration/        # Flyway SQL 파일 위치
│  └─ test/
│     ├─ java/
│     └─ resources/application-test.properties
├─ build.gradle
├─ gradlew
├─ gradlew.bat
└─ settings.gradle
```

| 폴더/파일 | 역할 |
|---|---|
| `global/config` | CORS, JPA Auditing처럼 기능과 관계없이 공통 적용되는 Spring 설정 |
| `global/constant` | 공통 HTTP 상태 코드 같은 상수 |
| `global/entity` | 모든 JPA 엔티티가 공통으로 상속할 `BaseEntity` |
| `global/exception` | 공통 예외 타입과 전역 예외 처리 |
| `global/response` | API 공통 성공·실패 응답 형식 |
| `global/response/code` | 성공·실패 응답 코드와 메시지 정의 |
| `domain` | 실제 서비스 도메인 코드를 둘 위치. 새 도메인은 `domain/<도메인명>`으로 생성 |
| `domain/example` | 실제 도메인 패키지 구조 예시 |
| `domain/example/entity` | JPA 엔티티와 도메인 모델 |
| `domain/example/repository` | JPA Repository, JdbcTemplate/JDBC 기반 데이터 접근 코드 |
| `domain/example/service` | 비즈니스 로직과 트랜잭션 처리 |
| `domain/example/controller` | HTTP 요청을 받는 REST Controller |
| `domain/example/dto/request` | API 요청 DTO |
| `domain/example/dto/response` | API 응답 DTO |
| `domain/example/error` | 도메인 오류 코드 |
| `domain/example/exception` | 도메인 예외 |
| `TrailMapApplication.java` | Spring Boot 애플리케이션 진입점 |
| `application.properties` | Git에 포함하는 공통 Spring 설정 |
| `application-secret.properties` | DB·R2 실제 키를 두는 로컬 파일. Git에 포함하지 않음 |
| `application-test.properties` | H2 기반 테스트 프로필 설정 |
| `docs/migration.md` | DB schema·PostGIS·Flyway migration 상세 규칙 |
| `resources/db/migration` | Flyway migration SQL 파일 위치 |
| `build.gradle` | Java 21, Spring Boot, JPA, JDBC, Flyway, PostgreSQL, R2 SDK 등 의존성 설정 |
| `gradlew`, `gradlew.bat` | 팀 전체가 동일한 Gradle 버전으로 실행하는 Wrapper |

## 비밀 설정 규칙

`backend/src/main/resources/application-secret.properties`에 실제 DB·R2 값을 입력합니다. 이 파일은 `backend/.gitignore`에 등록되어 GitHub에 올라가지 않습니다.
