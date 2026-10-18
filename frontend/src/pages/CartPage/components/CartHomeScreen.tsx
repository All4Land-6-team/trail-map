import { Button } from "../../../components/common/Button";
import { Typography } from "../../../components/common/Typography";
import { SavedMountainCard } from "../../../components/content";
import { BottomNavigation, type BottomDestination } from "../../../components/layout";
import type { CartCourse } from "../types";

type CartHomeScreenProps = {
  courses: readonly CartCourse[];
  onBrowseMountains: () => void;
  onNavigate: (destination: BottomDestination) => void;
  onSelectMountain: (mountainId: string) => void;
};

export function CartHomeScreen({
  courses,
  onBrowseMountains,
  onNavigate,
  onSelectMountain,
}: CartHomeScreenProps) {
  const groups = [...new Set(courses.map(course => course.mountainId))].map(id => ({
    id: id ?? "bukhansan", courses: courses.filter(course => course.mountainId === id),
  }));

  return (
    <main className="cart-screen cart-home-screen">
      <header className="cart-home-header">
        <Typography as="h1" variant="headingPage">등산 담기</Typography>
        <Typography as="p" variant="bodySmall">담아둔 코스를 모아보고 비교해요</Typography>
      </header>

      <section className="cart-saved-section" aria-labelledby="saved-mountains-title">
        <div className="cart-section-heading">
          <Typography as="h2" id="saved-mountains-title" variant="headingScreen">담은 산</Typography>
          <Typography variant="descriptionSmall">{groups.length}개</Typography>
        </div>

        {groups.length ? groups.map(group => (
          <SavedMountainCard
            key={group.id}
            mountain={group.courses[0].mountain}
            courseCount={`${group.courses.length}개 코스`}
            onClick={() => onSelectMountain(group.id)}
          />
        )) : (
          <div className="cart-empty-state">
            <Typography as="h3" variant="controlLabel">아직 담은 코스가 없어요</Typography>
            <Typography as="p" variant="descriptionSmall">
              산 코스 카드의 장바구니 아이콘을 눌러 코스를 담아 보세요.
            </Typography>
            <Button onClick={onBrowseMountains}>산 둘러보기</Button>
          </div>
        )}
      </section>

      <BottomNavigation active="saved" onNavigate={onNavigate} className="cart-bottom-nav" />
    </main>
  );
}
