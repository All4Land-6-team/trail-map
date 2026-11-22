import assert from 'node:assert/strict'
import test from 'node:test'

import { parsePhotoCaptureMetadata } from '../src/utils/photoExif.ts'

function createExifBuffer({ dateTime = '2026:11:19 14:35:20', offset = '+09:00' } = {}) {
  const buffer = new ArrayBuffer(128)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  const littleEndian = true

  bytes.set([0x49, 0x49, 0x2a, 0x00])
  view.setUint32(4, 8, littleEndian)
  view.setUint16(8, 2, littleEndian)

  writeAsciiEntry(view, bytes, 10, 0x0132, dateTime, 40)
  writeAsciiEntry(view, bytes, 22, 0x9010, offset, 72)
  return buffer
}

function writeAsciiEntry(view, bytes, entryOffset, tag, value, valueOffset) {
  view.setUint16(entryOffset, tag, true)
  view.setUint16(entryOffset + 2, 2, true)
  view.setUint32(entryOffset + 4, value.length + 1, true)
  view.setUint32(entryOffset + 8, valueOffset, true)
  bytes.set(new TextEncoder().encode(`${value}\0`), valueOffset)
}

test('EXIF 촬영 시각과 UTC 오프셋을 읽는다', () => {
  assert.deepEqual(parsePhotoCaptureMetadata(createExifBuffer()), {
    capturedAt: '2026-11-19T14:35:20+09:00',
    utcOffsetMinutes: 540,
  })
})

test('EXIF 오프셋이 없으면 촬영일의 브라우저 오프셋을 사용한다', () => {
  const buffer = createExifBuffer({ offset: 'invalid' })

  assert.deepEqual(parsePhotoCaptureMetadata(buffer, () => -300), {
    capturedAt: '2026-11-19T14:35:20-05:00',
    utcOffsetMinutes: -300,
  })
})

test('촬영 시각이 없는 파일은 환경정보를 만들지 않는다', () => {
  assert.equal(parsePhotoCaptureMetadata(new ArrayBuffer(16)), null)
})
