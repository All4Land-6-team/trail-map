import test from 'node:test'
import assert from 'node:assert/strict'
import { environmentPopoverPosition } from '../src/utils/environmentPopoverPosition.ts'

test('환경 팝오버는 공간이 충분하면 트리거 아래 우측에 맞춘다', () => {
  assert.deepEqual(
    environmentPopoverPosition(
      { top: 100, right: 300, bottom: 124 },
      { width: 220, height: 160 },
      { width: 390, height: 844 },
    ),
    { top: 132, left: 80 },
  )
})

test('환경 팝오버는 하단 공간이 부족하면 위로 열고 왼쪽 화면 안에 고정한다', () => {
  assert.deepEqual(
    environmentPopoverPosition(
      { top: 700, right: 30, bottom: 724 },
      { width: 220, height: 160 },
      { width: 390, height: 844 },
    ),
    { top: 532, left: 12 },
  )
})

test('환경 팝오버는 오른쪽 화면 밖으로 나가지 않는다', () => {
  assert.deepEqual(
    environmentPopoverPosition(
      { top: 100, right: 500, bottom: 124 },
      { width: 220, height: 160 },
      { width: 390, height: 844 },
    ),
    { top: 132, left: 158 },
  )
})
