export type PhotoCaptureMetadata = {
  capturedAt: string
  utcOffsetMinutes: number
}

type ExifFields = { dateTime?: string; offset?: string }

export async function readPhotoCaptureMetadata(file: File): Promise<PhotoCaptureMetadata | null> {
  return parsePhotoCaptureMetadata(await file.arrayBuffer())
}

export function parsePhotoCaptureMetadata(
  buffer: ArrayBuffer,
  browserOffsetForDate: (date: Date) => number = date => -date.getTimezoneOffset(),
): PhotoCaptureMetadata | null {
  const bytes = new Uint8Array(buffer)
  const tiffStart = findTiffStart(bytes)
  if (tiffStart < 0) return null
  const fields = readExifFields(new DataView(buffer), tiffStart)
  if (!fields.dateTime) return null
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(fields.dateTime.trim())
  if (!match) return null
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match
  const values = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number)
  const [year, month, day, hour, minute, second] = values
  const localDate = new Date(year, month - 1, day, hour, minute, second)
  if (localDate.getFullYear() !== year || localDate.getMonth() !== month - 1 || localDate.getDate() !== day
    || localDate.getHours() !== hour || localDate.getMinutes() !== minute || localDate.getSeconds() !== second) return null

  const exifOffset = parseOffset(fields.offset)
  const utcOffsetMinutes = exifOffset ?? browserOffsetForDate(localDate)
  if (!Number.isInteger(utcOffsetMinutes) || utcOffsetMinutes < -1080 || utcOffsetMinutes > 1080) return null
  const capturedAt = `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText}${formatOffset(utcOffsetMinutes)}`
  return Number.isFinite(Date.parse(capturedAt)) ? { capturedAt, utcOffsetMinutes } : null
}

function findTiffStart(bytes: Uint8Array) {
  for (let index = 0; index <= bytes.length - 4; index += 1) {
    const littleEndian = bytes[index] === 0x49 && bytes[index + 1] === 0x49 && bytes[index + 2] === 0x2a && bytes[index + 3] === 0
    const bigEndian = bytes[index] === 0x4d && bytes[index + 1] === 0x4d && bytes[index + 2] === 0 && bytes[index + 3] === 0x2a
    if (littleEndian || bigEndian) return index
  }
  return -1
}

function readExifFields(view: DataView, tiffStart: number): ExifFields {
  try {
    const littleEndian = view.getUint16(tiffStart, false) === 0x4949
    if (view.getUint16(tiffStart + 2, littleEndian) !== 42) return {}
    const ifd0Offset = readUint32(view, tiffStart + 4, littleEndian)
    const ifd0 = readIfd(view, tiffStart, tiffStart + ifd0Offset, littleEndian)
    const exifOffset = ifd0.numbers.get(0x8769)
    const exif = exifOffset === undefined ? emptyIfd() : readIfd(view, tiffStart, tiffStart + exifOffset, littleEndian)
    return {
      dateTime: exif.strings.get(0x9003) ?? exif.strings.get(0x9004) ?? ifd0.strings.get(0x0132),
      offset: exif.strings.get(0x9011) ?? ifd0.strings.get(0x9010),
    }
  } catch {
    return {}
  }
}

function emptyIfd() {
  return { strings: new Map<number, string>(), numbers: new Map<number, number>() }
}

function readIfd(view: DataView, tiffStart: number, ifdOffset: number, littleEndian: boolean) {
  const result = emptyIfd()
  const count = readUint16(view, ifdOffset, littleEndian)
  if (count > 512) return result
  for (let index = 0; index < count; index += 1) {
    const entry = ifdOffset + 2 + index * 12
    const tag = readUint16(view, entry, littleEndian)
    const type = readUint16(view, entry + 2, littleEndian)
    const valueCount = readUint32(view, entry + 4, littleEndian)
    if (type === 2 && valueCount > 0 && valueCount <= 128) {
      const valueOffset = valueCount <= 4 ? entry + 8 : tiffStart + readUint32(view, entry + 8, littleEndian)
      result.strings.set(tag, readAscii(view, valueOffset, valueCount))
    } else if ((type === 3 || type === 4) && valueCount === 1) {
      result.numbers.set(tag, type === 3 ? readUint16(view, entry + 8, littleEndian) : readUint32(view, entry + 8, littleEndian))
    }
  }
  return result
}

function readAscii(view: DataView, offset: number, length: number) {
  let result = ''
  for (let index = 0; index < length && offset + index < view.byteLength; index += 1) {
    const value = view.getUint8(offset + index)
    if (value === 0) break
    result += String.fromCharCode(value)
  }
  return result.trim()
}

function readUint16(view: DataView, offset: number, littleEndian: boolean) {
  if (offset < 0 || offset + 2 > view.byteLength) throw new RangeError('잘못된 EXIF 위치')
  return view.getUint16(offset, littleEndian)
}

function readUint32(view: DataView, offset: number, littleEndian: boolean) {
  if (offset < 0 || offset + 4 > view.byteLength) throw new RangeError('잘못된 EXIF 위치')
  return view.getUint32(offset, littleEndian)
}

function parseOffset(value: string | undefined) {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(value?.trim() ?? '')
  if (!match) return null
  const minutes = Number(match[2]) * 60 + Number(match[3])
  return match[1] === '-' ? -minutes : minutes
}

function formatOffset(totalMinutes: number) {
  const sign = totalMinutes < 0 ? '-' : '+'
  const absolute = Math.abs(totalMinutes)
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`
}
