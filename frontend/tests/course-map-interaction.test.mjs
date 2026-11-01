import assert from 'node:assert/strict';
import test from 'node:test';
import { createSettledSelection } from '../src/utils/settledCarouselSelection.ts';
import { createSheetPreviewSession } from '../src/utils/sheetPreviewSession.ts';

test('카드 이동 중 선택하지 않고 마지막 스크롤이 멈춘 뒤 한 번 확정한다', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let candidate = 'a';
  const selected = [];
  const selection = createSettledSelection(() => candidate, id => selected.push(id));
  selection.schedule();
  context.mock.timers.tick(100);
  candidate = 'b'; selection.schedule();
  context.mock.timers.tick(100);
  assert.deepEqual(selected, []);
  context.mock.timers.tick(80);
  assert.deepEqual(selected, ['b']);
  selection.cancel();
});

test('포인터가 눌린 동안 scrollend도 확정하지 않고 놓은 뒤 확정한다', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const selected = [];
  const selection = createSettledSelection(() => 'b', id => selected.push(id));
  selection.beginInteraction(); selection.schedule(); selection.settle();
  context.mock.timers.tick(1000);
  assert.deepEqual(selected, []);
  selection.endInteraction();
  context.mock.timers.tick(180);
  assert.deepEqual(selected, ['b']);
});

test('외부 선택·필터 교체·해제는 이전 지연 확정을 취소하고 최신 목록을 읽는다', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let candidate = 'old';
  const selected = [];
  const selection = createSettledSelection(() => candidate, id => selected.push(id));
  selection.schedule();
  selection.cancel(); candidate = 'external';
  context.mock.timers.tick(500);
  assert.deepEqual(selected, []);
  selection.schedule(); candidate = 'filtered'; selection.settle();
  context.mock.timers.tick(500);
  assert.deepEqual(selected, ['filtered']);
  selection.schedule(); selection.cancel();
  context.mock.timers.tick(500);
  assert.deepEqual(selected, ['filtered']);
});

test('미리보기 재개는 최초 시트 높이를 보존하고 종료 때 한 번 복원한다', () => {
  const session = createSheetPreviewSession();
  assert.equal(session.begin(296, false), true);
  assert.equal(session.begin(160, true), false);
  assert.deepEqual(session.end(), { height: 296, customized: false });
  assert.equal(session.end(), null);
  session.begin(400, true);
  assert.deepEqual(session.end(), { height: 400, customized: true });
});

test('드래그 시작·키보드·크기 변경은 미리보기 복원을 취소한다', () => {
  for (const interaction of ['pointer-down', 'keyboard', 'resize']) {
    const session = createSheetPreviewSession();
    session.begin(296, false);
    session.invalidate();
    assert.equal(session.begin(200, true), false, interaction);
    assert.equal(session.end(), null, interaction);
    assert.equal(session.active, false);
    assert.equal(session.begin(220, true), true);
    assert.deepEqual(session.end(), { height: 220, customized: true });
  }
});
