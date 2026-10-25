import { loadHomeDiscoveryData } from "./homeMock";
import type { Course, CourseDiscoveryData } from "../types/course";

// 로컬 테스트 DB의 mock 백운대 경로만 연결한다. 운영 빌드에는 테스트 ID를 연결하지 않는다.
const localBaegundaeCourseId = Number(import.meta.env?.VITE_MOCK_BAEGUNDAE_COURSE_ID ?? "2");
const mockBaegundaeBackendId = import.meta.env?.DEV && Number.isSafeInteger(localBaegundaeCourseId) && localBaegundaeCourseId > 0
  ? localBaegundaeCourseId : undefined;

// 화면 개발용 합성 데이터이며 실제 등산로·분석값·실시간 통제 정보가 아니다.
// 기존 등산 담기·내 등산 브랜치와 연결할 수 있도록 courseId를 유지한다.
export const courseFixtures: readonly Course[] = [
  {
    "id": "daenammun",
    "mountainId": "bukhansan",
    "name": "대남문 코스",
    "routeLabel": "북한산성 탐방지원센터 → 대남문",
    "difficulty": "beginner",
    "distanceKm": 5.6,
    "durationMinutes": 160,
    "elevationGainMeters": null,
    "peakElevationMeters": null,
    "steepRatioPercent": 8,
    "analysisStatus": "pending",
    "detailAvailable": false,
    "routeCoordinates": [
      [
        126.955,
        37.636
      ],
      [
        126.963,
        37.644
      ],
      [
        126.972,
        37.651
      ],
      [
        126.982,
        37.66
      ],
      [
        126.989,
        37.67
      ],
      [
        126.993,
        37.681
      ]
    ]
  },
  {
    "id": "bibong",
    "mountainId": "bukhansan",
    "name": "비봉 코스",
    "routeLabel": "비봉 탐방지원센터 → 비봉",
    "difficulty": "intermediate",
    "distanceKm": 3.8,
    "durationMinutes": 120,
    "elevationGainMeters": null,
    "peakElevationMeters": null,
    "steepRatioPercent": 18,
    "analysisStatus": "pending",
    "detailAvailable": false,
    "routeCoordinates": [
      [
        126.948,
        37.641
      ],
      [
        126.956,
        37.648
      ],
      [
        126.966,
        37.655
      ],
      [
        126.977,
        37.663
      ],
      [
        126.986,
        37.674
      ],
      [
        126.992,
        37.682
      ]
    ]
  },
  {
    "id": "sumunbyeok",
    "mountainId": "bukhansan",
    "name": "숨은벽 코스",
    "routeLabel": "밤골 탐방지원센터 → 숨은벽",
    "difficulty": "advanced",
    "distanceKm": 6.1,
    "durationMinutes": 200,
    "elevationGainMeters": null,
    "peakElevationMeters": null,
    "steepRatioPercent": null,
    "analysisStatus": "pending",
    "detailAvailable": false,
    "routeCoordinates": [
      [
        126.962,
        37.633
      ],
      [
        126.971,
        37.642
      ],
      [
        126.981,
        37.65
      ],
      [
        126.99,
        37.659
      ],
      [
        126.997,
        37.67
      ],
      [
        127.001,
        37.681
      ]
    ]
  },
  {
    "id": "bukhansan-baegundae",
    backendCourseId: mockBaegundaeBackendId,
    "mountainId": "bukhansan",
    "name": "백운대 코스",
    "routeLabel": "백운대 탐방지원센터 → 백운대",
    "difficulty": "intermediate",
    "distanceKm": 4.2,
    "durationMinutes": 130,
    "elevationGainMeters": 610,
    "peakElevationMeters": 836,
    "steepRatioPercent": 21,
    "analysisStatus": "ready",
    "detailAvailable": true,
    "routeCoordinates": [
      [
        126.9905,
        37.662
      ],
      [
        126.9885,
        37.6618
      ],
      [
        126.9866,
        37.6612
      ],
      [
        126.9852,
        37.6608
      ],
      [
        126.9836,
        37.6603
      ],
      [
        126.9818,
        37.66
      ],
      [
        126.9803,
        37.6596
      ],
      [
        126.979,
        37.6592
      ],
      [
        126.9776,
        37.6588
      ]
    ]
  },
  {
    "id": "bukhansan-bogukmun",
    "mountainId": "bukhansan",
    "name": "보국문 코스",
    "routeLabel": "정릉 탐방지원센터 → 보국문",
    "difficulty": "beginner",
    "distanceKm": 2.8,
    "durationMinutes": 80,
    "elevationGainMeters": null,
    "peakElevationMeters": null,
    "steepRatioPercent": 4,
    "analysisStatus": "pending",
    "detailAvailable": false,
    "routeCoordinates": [
      [
        127.004,
        37.622
      ],
      [
        127,
        37.627
      ],
      [
        126.995,
        37.633
      ],
      [
        126.99,
        37.64
      ]
    ]
  },
  {
    "id": "bukhansan-uiryeong",
    "mountainId": "bukhansan",
    "name": "우이령 코스",
    "routeLabel": "우이동 예시 출발점 → 예시 도착점",
    "difficulty": "beginner",
    "distanceKm": 1.8,
    "durationMinutes": 50,
    "elevationGainMeters": null,
    "peakElevationMeters": null,
    "steepRatioPercent": 2,
    "analysisStatus": "pending",
    "detailAvailable": false,
    "routeCoordinates": [
      [
        127.012,
        37.663
      ],
      [
        127.009,
        37.667
      ],
      [
        127.005,
        37.671
      ],
      [
        127,
        37.676
      ]
    ]
  },
  {
    "id": "bukhansan-samobawi",
    "mountainId": "bukhansan",
    "name": "사모바위 코스",
    "routeLabel": "예시 출발점 → 사모바위 → 예시 도착점",
    "difficulty": "advanced",
    "distanceKm": 7.2,
    "durationMinutes": 260,
    "elevationGainMeters": null,
    "peakElevationMeters": null,
    "steepRatioPercent": 32,
    "analysisStatus": "pending",
    "detailAvailable": false,
    "routeCoordinates": [
      [
        126.95,
        37.63
      ],
      [
        126.96,
        37.638
      ],
      [
        126.97,
        37.647
      ],
      [
        126.978,
        37.656
      ],
      [
        126.986,
        37.664
      ]
    ]
  },
  {
    "id": "dobongsan-sinseondae",
    "mountainId": "dobongsan",
    "name": "신선대 코스",
    "routeLabel": "도봉 탐방지원센터 → 신선대",
    "difficulty": "intermediate",
    "distanceKm": 5.1,
    "durationMinutes": 160,
    "elevationGainMeters": null,
    "peakElevationMeters": null,
    "steepRatioPercent": 15,
    "analysisStatus": "pending",
    "detailAvailable": false,
    "routeCoordinates": [
      [
        127.0465,
        37.6895
      ],
      [
        127.0432,
        37.6907
      ],
      [
        127.0398,
        37.6921
      ],
      [
        127.0369,
        37.6936
      ],
      [
        127.0341,
        37.6949
      ],
      [
        127.0318,
        37.6963
      ],
      [
        127.0296,
        37.6978
      ]
    ]
  },
  {
    "id": "seoraksan-biseondae",
    "mountainId": "seoraksan",
    "name": "비선대 코스",
    "routeLabel": "출발지 정보 확인 예정",
    "difficulty": null,
    "distanceKm": 4.5,
    "durationMinutes": 150,
    "elevationGainMeters": null,
    "peakElevationMeters": null,
    "steepRatioPercent": null,
    "analysisStatus": "pending",
    "detailAvailable": false,
    "routeCoordinates": [
      [
        128.447,
        38.099
      ],
      [
        128.455,
        38.107
      ],
      [
        128.461,
        38.113
      ],
      [
        128.465,
        38.119
      ]
    ]
  },
  {
    "id": "gwanaksan-yeonjudae",
    "mountainId": "gwanaksan",
    "name": "연주대 코스",
    "routeLabel": "출발지 정보 확인 예정",
    "difficulty": null,
    "distanceKm": 4.5,
    "durationMinutes": 150,
    "elevationGainMeters": null,
    "peakElevationMeters": null,
    "steepRatioPercent": null,
    "analysisStatus": "pending",
    "detailAvailable": false,
    "routeCoordinates": [
      [
        126.946,
        37.425
      ],
      [
        126.954,
        37.433
      ],
      [
        126.96,
        37.439
      ],
      [
        126.964,
        37.445
      ]
    ]
  },
  {
    "id": "jirisan-cheonwangbong",
    "mountainId": "jirisan",
    "name": "천왕봉 코스",
    "routeLabel": "출발지 정보 확인 예정",
    "difficulty": null,
    "distanceKm": 4.5,
    "durationMinutes": 150,
    "elevationGainMeters": null,
    "peakElevationMeters": null,
    "steepRatioPercent": null,
    "analysisStatus": "pending",
    "detailAvailable": false,
    "routeCoordinates": [
      [
        127.713,
        35.317
      ],
      [
        127.72099999999999,
        35.325
      ],
      [
        127.72699999999999,
        35.331
      ],
      [
        127.731,
        35.337
      ]
    ]
  }
];

/** 실제 API 연결 시 교체할 화면용 데이터 접근 함수. */
export async function loadCourseDiscoveryData(mountainId: string, signal: AbortSignal): Promise<CourseDiscoveryData | undefined> {
  const home = await loadHomeDiscoveryData(signal);
  signal.throwIfAborted();
  const mountain = home.mountains.find(item => item.id === mountainId);
  return mountain ? { mountain, courses: courseFixtures.filter(course => course.mountainId === mountainId) } : undefined;
}
