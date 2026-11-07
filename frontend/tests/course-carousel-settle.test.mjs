import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as selection from '../src/utils/settledCarouselSelection.ts';
import * as identity from '../src/utils/courseIdentity.ts';

function mountCarousel() {
  const slots = [], effects = [], trackListeners = new Map(), windowListeners = new Map();
  let index = 0;
  const react = {
    useRef(initial) { const slot = index++; return slots[slot] ??= { current: initial }; },
    useLayoutEffect(effect, dependencies) {
      const slot = index++;
      if (!dependencies || !slots[slot]?.dependencies || dependencies.some((value, i) => value !== slots[slot].dependencies[i])) {
        effects.push(() => { slots[slot]?.cleanup?.(); slots[slot] = { dependencies, cleanup: effect() }; });
      }
    },
  };
  react.useEffect = react.useLayoutEffect;
  const track = { scrollLeft: 0, children: [], getBoundingClientRect: () => ({ left: 0 }),
    scrollTo({ left }) { this.scrollLeft = left; },
    addEventListener: (name, callback) => trackListeners.set(name, callback),
    removeEventListener: name => trackListeners.delete(name), hasPointerCapture: () => false,
  };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/pages/CourseListPage/components/CourseCarousel.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => name === 'react' ? react : name === 'react/jsx-runtime' ? { jsx, jsxs: jsx }
    : name.endsWith('courseIdentity') ? identity : name.endsWith('settledCarouselSelection') ? selection : name.endsWith('courseDiscovery')
      ? { COURSE_DIFFICULTY_LABELS: {}, formatCourseDuration: () => '정보 없음' } : { CourseCard: 'card' },
    window: { addEventListener: (name, callback) => windowListeners.set(name, callback), removeEventListener: name => windowListeners.delete(name) },
  });
  return {
    track,
    render(props) {
      index = 0;
      const result = exports.CourseCarousel({ savedIds: [], scheduledIds: [], ...props });
      result.props.ref.current = track;
      track.children = props.courses.map((_, i) => ({ getBoundingClientRect: () => ({ left: 18 + 320 * i - track.scrollLeft }) }));
      effects.splice(0).forEach(effect => effect());
      return result.props;
    },
    scrollEnd: () => trackListeners.get('scrollend')?.(),
    unmount: () => slots.forEach(slot => slot?.cleanup?.()),
    listenerCount: () => trackListeners.size + windowListeners.size,
  };
}
const course = id => ({ id, name: id, distanceKm: 1, durationMinutes: null });

test('같은 코스의 외부 재선택 revision도 이전 스와이프를 취소하고 왼쪽 스냅으로 복귀한다', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const carousel = mountCarousel(), selected = [], courses = [course('a'), course('b')];
  const props = { courses, selectedId: 'a', onSelect: id => selected.push(id) };
  let handlers = carousel.render(props);
  carousel.track.scrollLeft = 320; handlers.onScroll();
  handlers = carousel.render({ ...props, selectionRevision: 1 });
  assert.equal(carousel.track.scrollLeft, 0);
  carousel.scrollEnd(); context.mock.timers.tick(500);
  assert.deepEqual(selected, []);
  carousel.track.scrollLeft = 320; handlers.onScroll(); carousel.scrollEnd();
  assert.deepEqual(selected, ['b']);
  carousel.unmount(); assert.equal(carousel.listenerCount(), 0);
});

test('필터 목록 교체는 이전 타이머를 폐기하고 새 카드의 ID로만 안착 선택한다', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const carousel = mountCarousel(), selected = [];
  const props = { selectedId: 'a', onSelect: id => selected.push(id) };
  let handlers = carousel.render({ ...props, courses: [course('a'), course('old')] });
  carousel.track.scrollLeft = 320; handlers.onScroll();
  handlers = carousel.render({ ...props, courses: [course('a'), course('new')] });
  context.mock.timers.tick(500); assert.deepEqual(selected, []);
  handlers.onPointerDown({ isPrimary: true, pointerType: 'touch' });
  carousel.track.scrollLeft = 320; handlers.onScroll(); carousel.scrollEnd();
  context.mock.timers.tick(500); assert.deepEqual(selected, []);
  handlers.onPointerUp({ currentTarget: carousel.track });
  context.mock.timers.tick(180); assert.deepEqual(selected, ['new']);
  carousel.track.scrollLeft = 0; handlers.onScroll(); carousel.unmount();
  context.mock.timers.tick(500); assert.deepEqual(selected, ['new']);
});
